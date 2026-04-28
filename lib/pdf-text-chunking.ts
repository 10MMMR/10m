export type PdfPageText = {
  page: number;
  text: string;
};

export type PdfChunk = {
  chunk_index: number;
  content: string;
  word_count: number;
  page_start: number;
  page_end: number;
  pages: number[];
};

type ParagraphUnit = {
  text: string;
  pages: number[];
};

type PositionClass = "header" | "footer";

type HeaderFooterCandidate = {
  line: string;
  normalized: string;
  page: number;
  positionClass: PositionClass;
};

const DEFAULT_CHUNK_SIZE_CHARS = 1400;
const DEFAULT_CHUNK_OVERLAP_CHARS = 225;
const CHARS_PER_WORD_ESTIMATE = 4;
const MAX_OVERFLOW_RATIO = 1.15;
const MAX_CHUNK_PAGE_SPAN = 2;

function normalizeInlineSpaces(value: string) {
  return value.replace(/[ \t\f\v\u00A0]+/g, " ").trim();
}

function normalizeLine(value: string) {
  return normalizeInlineSpaces(value.replace(/\u00A0/g, " "));
}

export function countWords(value: string) {
  if (!value.trim()) {
    return 0;
  }

  return value.trim().split(/\s+/).length;
}

function endsLikeSentence(value: string) {
  return /[.!?]["')\]]?$/.test(value.trim());
}

function startsLikeContinuation(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return false;
  }

  return /^[a-z0-9(["']/.test(trimmed);
}

function isObviousPageMarkerLine(value: string) {
  const line = value.trim();

  if (!line || line.length > 24) {
    return false;
  }

  // "Page 3", "page 3", "Page 3 of 12"
  if (/^page\s+\d{1,5}(?:\s+of\s+\d{1,5})?$/i.test(line)) {
    return true;
  }

  // "p. 3", "p 3"
  if (/^p\.?\s*\d{1,5}$/i.test(line)) {
    return true;
  }

  // "- 3 -", "(3)", "[3]", "3"
  if (/^(?:[-–—]\s*)?[\(\[]?\d{1,5}[\)\]]?(?:\s*[-–—])?$/.test(line)) {
    return true;
  }

  // "3/12"
  if (/^\d{1,5}\s*\/\s*\d{1,5}$/.test(line)) {
    return true;
  }

  return false;
}

export function cleanText(value: string) {
  const normalized = value
    .replace(/\r\n?/g, "\n")
    // Rejoin words split by PDF line wrapping, e.g. "na-\nme" -> "name".
    // Only targets a dash immediately followed by a line break.
    .replace(/([A-Za-z0-9])-\n\s*(?=[A-Za-z0-9])/g, "$1");
  const lines = normalized.split("\n");
  const merged: string[] = [];

  for (const rawLine of lines) {
    const line = normalizeInlineSpaces(rawLine);

    if (!line) {
      if (merged[merged.length - 1] !== "") {
        merged.push("");
      }
      continue;
    }

    if (isObviousPageMarkerLine(line)) {
      continue;
    }

    const previous = merged[merged.length - 1];

    if (!previous || !previous.trim()) {
      merged.push(line);
      continue;
    }

    const shouldMergeWithPrevious =
      !endsLikeSentence(previous) &&
      startsLikeContinuation(line) &&
      !/[:;]$/.test(previous.trim());

    if (shouldMergeWithPrevious) {
      merged[merged.length - 1] = `${previous} ${line}`;
      continue;
    }

    merged.push(line);
  }

  return merged.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export const cleanPdfPageText = cleanText;

function collectHeaderFooterCandidates(pages: PdfPageText[]) {
  const candidates: HeaderFooterCandidate[] = [];

  for (const page of pages) {
    const lines = (page.text ?? "").replace(/\r\n?/g, "\n").split("\n");

    if (lines.length < 6) {
      // Extremely short pages are likely all content, so skip conservative removal.
      continue;
    }

    const topLimit = Math.min(3, lines.length);
    const bottomStart = Math.max(0, lines.length - 3);

    for (let index = 0; index < topLimit; index += 1) {
      const line = lines[index];
      const normalized = normalizeLine(line);

      if (!normalized) {
        continue;
      }

      candidates.push({
        line,
        normalized,
        page: page.page,
        positionClass: "header",
      });
    }

    for (let index = bottomStart; index < lines.length; index += 1) {
      const line = lines[index];
      const normalized = normalizeLine(line);

      if (!normalized) {
        continue;
      }

      candidates.push({
        line,
        normalized,
        page: page.page,
        positionClass: "footer",
      });
    }
  }

  return candidates;
}

function isSafeToRemoveLine(line: string) {
  const normalized = normalizeLine(line);

  if (!normalized) {
    return false;
  }

  const words = countWords(normalized);

  // Keep likely real content: long text, bullets, equations, descriptive sentence-like lines.
  if (words >= 7) {
    return false;
  }

  if (/^\s*[-*•◦▪]\s+/.test(normalized)) {
    return false;
  }

  if (/[=<>±×÷∑∫√^_]/.test(normalized) || /\b\d+\s*[+\-*/]\s*\d+\b/.test(normalized)) {
    return false;
  }

  if (/[.!?]/.test(normalized) && words >= 5) {
    return false;
  }

  if (/^(chapter|section|unit|lesson|example|definition|theorem|proof)\b/i.test(normalized)) {
    return false;
  }

  const hasBoilerplateSignal =
    /(university|college|department|all rights reserved|copyright|confidential|semester|www\.|http|@)/i.test(
      normalized,
    ) || /\b[A-Z]{2,}\s?-?\d{2,4}\b/.test(normalized);
  const lettersOnly = normalized.replace(/[^A-Za-z]/g, "");
  const mostlyUppercase = lettersOnly.length > 0 && lettersOnly === lettersOnly.toUpperCase();
  const lowSemanticWeight = words <= 4 || normalized.length <= 28;

  return lowSemanticWeight && (hasBoilerplateSignal || mostlyUppercase || isObviousPageMarkerLine(normalized));
}

function scoreRepeatedLines(
  candidates: HeaderFooterCandidate[],
  pageCount: number,
  thresholdRatio = 0.7,
) {
  const grouped = new Map<
    string,
    {
      line: string;
      pages: Set<number>;
      positionClass: PositionClass;
    }
  >();

  for (const candidate of candidates) {
    const key = `${candidate.positionClass}::${candidate.normalized}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.pages.add(candidate.page);
      continue;
    }

    grouped.set(key, {
      line: candidate.line,
      pages: new Set([candidate.page]),
      positionClass: candidate.positionClass,
    });
  }

  const removable = new Set<string>();
  const requiredPages = Math.max(3, Math.ceil(pageCount * thresholdRatio));

  for (const [key, group] of grouped.entries()) {
    if (group.pages.size < requiredPages) {
      continue;
    }

    if (!isSafeToRemoveLine(group.line)) {
      continue;
    }

    // Removed only when all three signals agree:
    // high repetition + consistent top/bottom position + low semantic value.
    removable.add(key);
  }

  return removable;
}

function removeRepeatedHeadersAndFooters(pages: PdfPageText[]) {
  if (pages.length < 3) {
    return pages;
  }

  const candidates = collectHeaderFooterCandidates(pages);
  const removableKeys = scoreRepeatedLines(candidates, pages.length, 0.7);

  if (removableKeys.size === 0) {
    return pages;
  }

  return pages.map((page) => {
    const lines = (page.text ?? "").replace(/\r\n?/g, "\n").split("\n");
    const topLimit = Math.min(3, lines.length);
    const bottomStart = Math.max(0, lines.length - 3);
    const keptLines: string[] = [];

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const normalized = normalizeLine(line);
      const inHeaderRegion = index < topLimit;
      const inFooterRegion = index >= bottomStart;
      const positionClass: PositionClass | null = inHeaderRegion
        ? "header"
        : inFooterRegion
          ? "footer"
          : null;

      if (
        positionClass &&
        normalized &&
        removableKeys.has(`${positionClass}::${normalized}`)
      ) {
        continue;
      }

      keptLines.push(line);
    }

    return {
      page: page.page,
      text: keptLines.join("\n"),
    } satisfies PdfPageText;
  });
}

/**
 * Header/footer cleanup example:
 * Before:
 * - p1 top: "State University - CS101", body: "Neural networks...", bottom: "Page 1 of 12"
 * - p2 top: "State University - CS101", body: "Backpropagation...", bottom: "Page 2 of 12"
 * - p3 top: "State University - CS101", body: "Optimization...", bottom: "Page 3 of 12"
 *
 * After:
 * - repeated header/footer boilerplate removed from top/bottom regions
 * - body content preserved
 *
 * Kept-on-purpose example:
 * - repeated-looking heading "Introduction to Derivatives"
 * - if it does not score as low-semantic boilerplate, it remains.
 */

function splitIntoParagraphs(page: PdfPageText) {
  const cleaned = cleanText(page.text ?? "");

  if (!cleaned) {
    return [] as ParagraphUnit[];
  }

  return cleaned
    .split(/\n\s*\n+/)
    .map((paragraph) => normalizeInlineSpaces(paragraph.replace(/\n+/g, " ")))
    .filter(Boolean)
    .map((text) => ({
      text,
      pages: [page.page],
    }));
}

function shouldMergeAcrossPages(previous: ParagraphUnit, current: ParagraphUnit) {
  if (previous.pages.length !== 1 || current.pages.length !== 1) {
    return false;
  }

  const previousPage = previous.pages[0];
  const currentPage = current.pages[0];

  if (currentPage !== previousPage + 1) {
    return false;
  }

  return !endsLikeSentence(previous.text) && startsLikeContinuation(current.text);
}

function splitIntoSentences(value: string) {
  const text = normalizeInlineSpaces(value);

  if (!text) {
    return [] as string[];
  }

  const matches = text.match(/[^.!?]+(?:[.!?]+["')\]]*)|[^.!?]+$/g);

  if (!matches) {
    return [text];
  }

  return matches.map((sentence) => normalizeInlineSpaces(sentence)).filter(Boolean);
}

function splitIntoClauses(value: string) {
  const text = normalizeInlineSpaces(value);

  if (!text) {
    return [] as string[];
  }

  const parts = text
    .split(/(?<=[,;:])\s+|(?<=[–—-])\s+(?=[A-Za-z0-9])/)
    .map((part) => normalizeInlineSpaces(part))
    .filter(Boolean);

  return parts.length > 0 ? parts : [text];
}

function splitByWordWindow(value: string, maxWords: number, overlapWords: number) {
  const words = normalizeInlineSpaces(value).split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return [] as string[];
  }

  if (words.length <= maxWords) {
    return [words.join(" ")];
  }

  const rawStep = maxWords - Math.min(overlapWords, maxWords - 1);
  const step = Math.max(1, rawStep);
  const chunks: string[] = [];

  for (let start = 0; start < words.length; start += step) {
    const end = Math.min(start + maxWords, words.length);
    const piece = words.slice(start, end).join(" ");

    if (piece) {
      chunks.push(piece);
    }

    if (end >= words.length) {
      break;
    }
  }

  return chunks;
}

function groupPartsWithSoftAndHardLimits(
  parts: string[],
  targetWords: number,
  hardMaxWords: number,
  overlapWords: number,
) {
  const groups: string[] = [];
  let current: string[] = [];
  let currentWordCount = 0;

  const flushCurrent = () => {
    if (current.length === 0) {
      return;
    }

    const text = normalizeInlineSpaces(current.join(" "));

    if (text) {
      groups.push(text);
    }

    current = [];
    currentWordCount = 0;
  };

  for (const part of parts) {
    const normalizedPart = normalizeInlineSpaces(part);

    if (!normalizedPart) {
      continue;
    }

    const partWordCount = countWords(normalizedPart);

    if (partWordCount > hardMaxWords) {
      flushCurrent();
      groups.push(...splitByWordWindow(normalizedPart, targetWords, overlapWords));
      continue;
    }

    const nextWordCount = currentWordCount + partWordCount;

    if (nextWordCount > hardMaxWords) {
      flushCurrent();
      current.push(normalizedPart);
      currentWordCount = partWordCount;
      continue;
    }

    current.push(normalizedPart);
    currentWordCount = nextWordCount;
  }

  flushCurrent();

  return groups;
}

async function splitLargeParagraph(
  unit: ParagraphUnit,
  targetWords: number,
  hardMaxWords: number,
  overlapWords: number,
) {
  if (countWords(unit.text) <= hardMaxWords) {
    return [unit];
  }

  // Fallback order for oversized paragraphs:
  // 1) sentence groups, 2) clause groups, 3) raw word windows.
  const sentences = splitIntoSentences(unit.text);

  if (sentences.length <= 1) {
    const clauses = splitIntoClauses(unit.text);
    const clauseGroups = groupPartsWithSoftAndHardLimits(
      clauses,
      targetWords,
      hardMaxWords,
      overlapWords,
    );
    const groups =
      clauseGroups.length > 0 ? clauseGroups : splitByWordWindow(unit.text, targetWords, overlapWords);

    return groups.map((text) => ({
      text,
      pages: unit.pages,
    }));
  }

  const sentenceGroups = groupPartsWithSoftAndHardLimits(
    sentences,
    targetWords,
    hardMaxWords,
    overlapWords,
  );

  return sentenceGroups.map((text) => ({
    text,
    pages: unit.pages,
  }));
}

function buildTextFromUnits(units: ParagraphUnit[]) {
  return normalizeInlineSpaces(units.map((unit) => unit.text).join(" "));
}

function getPagesFromUnits(units: ParagraphUnit[]) {
  return Array.from(new Set(units.flatMap((unit) => unit.pages))).sort(
    (left, right) => left - right,
  );
}

function getPageSpan(pages: number[]) {
  if (pages.length === 0) {
    return 0;
  }

  return pages[pages.length - 1] - pages[0] + 1;
}

function canAppendUnit(currentUnits: ParagraphUnit[], unit: ParagraphUnit) {
  return getPageSpan(getPagesFromUnits([...currentUnits, unit])) <= MAX_CHUNK_PAGE_SPAN;
}

function estimateWordsFromChars(value: number) {
  return Math.max(1, Math.round(value / CHARS_PER_WORD_ESTIMATE));
}

function getOverlapUnits(previousUnits: ParagraphUnit[], overlapWords: number) {
  if (previousUnits.length === 0 || overlapWords <= 0) {
    return [] as ParagraphUnit[];
  }

  const previousText = buildTextFromUnits(previousUnits);

  if (!previousText) {
    return [] as ParagraphUnit[];
  }

  // Overlap priority:
  // 1) full trailing sentence(s), 2) paragraph-tail, 3) raw trailing words.
  const tailSentences = splitIntoSentences(previousText);
  const selectedSentences: string[] = [];
  let sentenceWordCount = 0;

  for (let index = tailSentences.length - 1; index >= 0; index -= 1) {
    const sentence = tailSentences[index];
    const words = countWords(sentence);

    if (selectedSentences.length > 0 && sentenceWordCount + words > overlapWords) {
      break;
    }

    selectedSentences.unshift(sentence);
    sentenceWordCount += words;

    if (sentenceWordCount >= overlapWords) {
      break;
    }
  }

  if (selectedSentences.length > 0 && sentenceWordCount <= overlapWords) {
    const pages = Array.from(new Set(previousUnits.slice(-2).flatMap((unit) => unit.pages))).sort(
      (left, right) => left - right,
    );
    const sentenceText = normalizeInlineSpaces(selectedSentences.join(" "));

    if (sentenceText) {
      return [
        {
          text: sentenceText,
          pages,
        },
      ];
    }
  }

  const tailUnit = previousUnits[previousUnits.length - 1];

  if (tailUnit) {
    const tailWords = countWords(tailUnit.text);

    if (tailWords > 0 && tailWords <= overlapWords) {
      return [
        {
          text: tailUnit.text,
          pages: tailUnit.pages,
        },
      ];
    }
  }

  const words = previousText.split(/\s+/).filter(Boolean);
  const rawTail = words.slice(Math.max(0, words.length - overlapWords)).join(" ").trim();

  if (!rawTail) {
    return [] as ParagraphUnit[];
  }

  const pages = Array.from(new Set(previousUnits.slice(-2).flatMap((unit) => unit.pages))).sort(
    (left, right) => left - right,
  );

  return [
    {
      text: rawTail,
      pages,
    },
  ];
}

async function collectParagraphUnits(pages: PdfPageText[]) {
  const prepared = pages
    .map((page) => ({
      page: page.page,
      text: page.text ?? "",
    }))
    .filter((page) => page.page > 0 && typeof page.text === "string");
  const preparedWithoutBoilerplate = removeRepeatedHeadersAndFooters(prepared);

  if (preparedWithoutBoilerplate.length === 0) {
    return [] as ParagraphUnit[];
  }

  const stitched: ParagraphUnit[] = [];

  for (const page of preparedWithoutBoilerplate) {
    const paragraphs = splitIntoParagraphs(page);

    for (const paragraph of paragraphs) {
      const previous = stitched[stitched.length - 1];

      if (previous && shouldMergeAcrossPages(previous, paragraph)) {
        previous.text = `${previous.text} ${paragraph.text}`;
        previous.pages = Array.from(new Set([...previous.pages, ...paragraph.pages])).sort(
          (left, right) => left - right,
        );
        continue;
      }

      stitched.push(paragraph);
    }
  }

  const expanded: ParagraphUnit[] = [];
  const targetWords = estimateWordsFromChars(DEFAULT_CHUNK_SIZE_CHARS);
  const hardMaxWords = Math.round(targetWords * MAX_OVERFLOW_RATIO);
  const overlapWords = estimateWordsFromChars(DEFAULT_CHUNK_OVERLAP_CHARS);

  for (const paragraph of stitched) {
    const pieces = await splitLargeParagraph(paragraph, targetWords, hardMaxWords, overlapWords);
    expanded.push(...pieces);
  }

  return expanded;
}

function buildChunk(index: number, content: string, units: ParagraphUnit[]) {
  const pages = getPagesFromUnits(units);

  return {
    chunk_index: index,
    content,
    word_count: countWords(content),
    page_start: pages[0] ?? 0,
    page_end: pages[pages.length - 1] ?? 0,
    pages,
  } satisfies PdfChunk;
}

export async function chunkPdfText(
  pages: PdfPageText[],
  options?: {
    chunkSizeChars?: number;
    chunkOverlapChars?: number;
  },
) {
  const chunkSizeChars = options?.chunkSizeChars ?? DEFAULT_CHUNK_SIZE_CHARS;
  const chunkOverlapChars = options?.chunkOverlapChars ?? DEFAULT_CHUNK_OVERLAP_CHARS;
  const targetWords = estimateWordsFromChars(chunkSizeChars);
  const hardMaxWords = Math.round(targetWords * MAX_OVERFLOW_RATIO);
  const overlapWords = estimateWordsFromChars(chunkOverlapChars);

  const units = await collectParagraphUnits(pages);

  if (units.length === 0) {
    return [] as PdfChunk[];
  }

  const chunks: PdfChunk[] = [];
  let chunkIndex = 0;
  let currentUnits: ParagraphUnit[] = [];
  let currentWordCount = 0;

  const flushChunk = () => {
    const content = buildTextFromUnits(currentUnits);

    if (!content) {
      return [] as ParagraphUnit[];
    }

    chunks.push(buildChunk(chunkIndex, content, currentUnits));
    chunkIndex += 1;

    return getOverlapUnits(currentUnits, overlapWords);
  };

  for (const unit of units) {
    const text = normalizeInlineSpaces(unit.text);

    if (!text) {
      continue;
    }

    const wordCount = countWords(text);
    const lastCurrentUnit = currentUnits[currentUnits.length - 1];
    const canCloseAtSentenceBoundary =
      currentUnits.length > 0 &&
      currentWordCount >= targetWords &&
      endsLikeSentence(lastCurrentUnit?.text ?? "") &&
      currentWordCount + wordCount > targetWords;

    if (canCloseAtSentenceBoundary) {
      const overlapSeed = flushChunk();
      currentUnits = overlapSeed;
      currentWordCount = countWords(buildTextFromUnits(currentUnits));
    }

    const wouldExceedHardMax = currentWordCount + wordCount > hardMaxWords;

    // End chunks on semantic unit boundaries when possible, while allowing
    // small overflow up to hardMaxWords to keep full sentences together.
    if (wouldExceedHardMax && currentUnits.length > 0) {
      const overlapSeed = flushChunk();
      currentUnits = overlapSeed;
      currentWordCount = countWords(buildTextFromUnits(currentUnits));
    }

    if (currentUnits.length > 0 && !canAppendUnit(currentUnits, unit)) {
      const overlapSeed = flushChunk();
      currentUnits = canAppendUnit(overlapSeed, unit) ? overlapSeed : [];
      currentWordCount = countWords(buildTextFromUnits(currentUnits));
    }

    currentUnits.push({
      text,
      pages: unit.pages,
    });
    currentWordCount += wordCount;
  }

  if (currentUnits.length > 0) {
    flushChunk();
  }

  return chunks.map((chunk, index) => ({
    ...chunk,
    chunk_index: index,
  }));
}

export type ChunkEmbedding = {
  chunk_index: number;
  content: string;
  page_start: number;
  page_end: number;
  pages: number[];
  embedding: number[];
};

export function pairChunksWithEmbeddings(chunks: PdfChunk[], embeddings: number[][]) {
  return chunks.map((chunk, index) => ({
    chunk_index: chunk.chunk_index,
    content: chunk.content,
    page_start: chunk.page_start,
    page_end: chunk.page_end,
    pages: chunk.pages,
    embedding: embeddings[index] ?? [],
  } satisfies ChunkEmbedding));
}

/**
 * Example input:
 * const pages: PdfPageText[] = [
 *   {
 *     page: 1,
 *     text: "Very long paragraph ... (420+ words) ... it is split into sentence groups first."
 *   },
 *   {
 *     page: 2,
 *     text: "This sentence stays intact. This one also stays intact for chunk ending."
 *   },
 * ];
 *
 * Example usage:
 * const chunks = await chunkPdfText(pages);
 *
 * Example behavior:
 * 1) Oversized paragraph is split by sentence groups (and only then by word windows if still needed).
 * 2) Chunk endings stay on sentence boundaries when possible (no mid-sentence truncation).
 * 3) Overlap repeats the last full sentence when possible instead of arbitrary trailing fragments.
 *
 * Example output shape:
 * [
 *   {
 *     chunk_index: 0,
 *     content: "Sentence A. Sentence B. Sentence C.",
 *     word_count: 340,
 *     page_start: 1,
 *     page_end: 1,
 *     pages: [1],
 *   },
 *   {
 *     chunk_index: 1,
 *     content: "Sentence C. Sentence D. Sentence E.",
 *     word_count: 332,
 *     page_start: 1,
 *     page_end: 2,
 *     pages: [1, 2],
 *   },
 * ]
 *
 * Example embedding attachment:
 * const chunksWithEmbeddings = pairChunksWithEmbeddings(chunks, [[0.12, 0.98]]);
 * [
 *   {
 *     chunk_index: 0,
 *     content: "Introduction paragraph...",
 *     pages: [1, 2],
 *     embedding: [0.12, 0.98],
 *   },
 * ]
 */
