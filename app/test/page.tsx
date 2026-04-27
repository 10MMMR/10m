"use client";

import { type ChangeEvent, useState } from "react";
import {
  chunkPdfText,
  pairChunksWithEmbeddings,
  type ChunkEmbedding,
  type PdfChunk,
  type PdfPageText,
} from "@/lib/pdf-text-chunking";

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfJsPromise: Promise<PdfJsModule> | null = null;

const loadPdfJs = async () => {
  if (!pdfJsPromise) {
    pdfJsPromise = import("pdfjs-dist/legacy/build/pdf.mjs");
  }

  return pdfJsPromise;
};

const readPdfPages = async (file: File): Promise<PdfPageText[]> => {
  if (typeof window === "undefined") {
    throw new Error("PDF parsing is only available in the browser.");
  }

  const pdfJs = await loadPdfJs();
  const { getDocument, GlobalWorkerOptions } = pdfJs;
  const getDocumentCompat = getDocument as unknown as (source: {
    data: Uint8Array;
    disableWorker?: boolean;
  }) => ReturnType<typeof getDocument>;
  GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const bytes = new Uint8Array(await file.arrayBuffer());
  let pdf: Awaited<ReturnType<typeof getDocument>["promise"]>;

  try {
    pdf = await getDocumentCompat({
      data: bytes,
    }).promise;
  } catch {
    // Worker loading can fail in some bundling contexts; retry on main thread.
    pdf = await getDocumentCompat({
      data: bytes,
      disableWorker: true,
    }).promise;
  }

  const pages: PdfPageText[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => {
        if (!("str" in item)) {
          return "";
        }

        const suffix = "hasEOL" in item && item.hasEOL ? "\n" : " ";
        return `${item.str}${suffix}`;
      })
      .join("")
      .replace(/[ \t]+\n/g, "\n")
      .trim();

    if (text) {
      pages.push({
        page: pageNumber,
        text,
      });
    }
  }

  return pages;
};

export default function TestPage() {
  const [extractedPages, setExtractedPages] = useState<PdfPageText[]>([]);
  const [chunks, setChunks] = useState<PdfChunk[]>([]);
  const [chunksWithEmbeddings, setChunksWithEmbeddings] = useState<ChunkEmbedding[]>([]);
  const [chunkVectors, setChunkVectors] = useState<Record<number, number[]>>({});
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [isEmbedding, setIsEmbedding] = useState(false);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsReading(true);
    setIsEmbedding(false);
    setError(null);
    setExtractedPages([]);
    setChunks([]);
    setChunksWithEmbeddings([]);
    setChunkVectors({});
    setPageCount(0);

    try {
      if (file.type && file.type !== "application/pdf") {
        throw new Error("Please upload a PDF file.");
      }

      const pages = await readPdfPages(file);
      setExtractedPages(pages);
      setPageCount(pages.length);
      const nextChunks = await chunkPdfText(pages);
      setChunks(nextChunks);
      setIsReading(false);

      if (nextChunks.length === 0) {
        return;
      }

      setIsEmbedding(true);

      const response = await fetch("/test/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chunks: nextChunks.map((chunk) => chunk.content),
        }),
      });
      const payload = (await response.json()) as {
        embeddings?: unknown;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Unable to generate chunk embeddings.");
      }

      if (!Array.isArray(payload.embeddings)) {
        throw new Error("Invalid embeddings response.");
      }

      const embeddingRows = payload.embeddings.map((entry) =>
        Array.isArray(entry)
          ? entry.filter((value): value is number => typeof value === "number")
          : [],
      );
      const paired = pairChunksWithEmbeddings(nextChunks, embeddingRows);
      setChunksWithEmbeddings(paired);
      const vectorsByChunkIndex = Object.fromEntries(
        paired.map((item) => [item.chunk_index, item.embedding]),
      );
      setChunkVectors(vectorsByChunkIndex);
    } catch (extractionError) {
      const message =
        extractionError instanceof Error
          ? extractionError.message
          : "Could not extract text from this PDF. Please try again.";
      setError(message);
    } finally {
      setIsEmbedding(false);
      setIsReading(false);
      event.target.value = "";
    }
  };

  return (
    <main className='mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-6 px-4 py-10 text-(--text-main) sm:px-6'>
      <h1 className='display-font text-3xl font-bold'>Test Sandbox</h1>

      <div className='flex items-center gap-3'>
        <label
          className='organic-button organic-button-primary inline-flex min-h-11 cursor-pointer items-center justify-center'
          htmlFor='upload-file'
        >
          Upload
        </label>
        <input
          accept='.pdf,application/pdf'
          className='sr-only'
          id='upload-file'
          onChange={handleFileChange}
          type='file'
        />
        {isReading ? (
          <p className='text-sm text-(--text-muted)'>Extracting text...</p>
        ) : isEmbedding ? (
          <p className='text-sm text-(--text-muted)'>Generating embeddings...</p>
        ) : null}
      </div>

      {error ? (
        <p className='rounded-xl border border-(--destructive) bg-(--surface-panel) px-4 py-3 text-sm text-(--destructive)'>
          {error}
        </p>
      ) : null}

      <section className='rounded-2xl border border-(--border-soft) bg-(--surface-panel) p-4'>
        <h2 className='text-sm font-semibold uppercase tracking-[0.08em] text-(--text-muted)'>
          Chunks
        </h2>
        {chunks.length > 0 ? (
          <div className='mt-3 space-y-4'>
            <p className='text-sm text-(--text-muted)'>
              {chunks.length} chunk{chunks.length === 1 ? "" : "s"} from {pageCount} page
              {pageCount === 1 ? "" : "s"}
            </p>
            {chunks.map((chunk) => (
              <article
                className='rounded-xl border border-(--border-soft) bg-(--surface-background) p-3'
                key={chunk.chunk_index}
              >
                <p className='text-xs font-medium uppercase tracking-[0.08em] text-(--text-muted)'>
                  Chunk {chunk.chunk_index} • Words {chunk.word_count} • Pages{" "}
                  {chunk.pages.join(", ")} • Start {chunk.page_start} • End {chunk.page_end}
                </p>
                <pre className='mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-(--text-main)'>
                  {chunk.content}
                </pre>
                <div className='mt-3 rounded-lg border border-(--border-soft) bg-(--surface-panel) p-2'>
                  <p className='text-xs font-medium uppercase tracking-[0.08em] text-(--text-muted)'>
                    Vector
                  </p>
                  <pre className='mt-2 max-h-44 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-(--text-main)'>
                    {JSON.stringify(chunkVectors[chunk.chunk_index] ?? [], null, 2)}
                  </pre>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className='mt-3 text-sm text-(--text-main)'>No file processed yet.</p>
        )}
      </section>

      <section className='rounded-2xl border border-(--border-soft) bg-(--surface-panel) p-4'>
        <h2 className='text-sm font-semibold uppercase tracking-[0.08em] text-(--text-muted)'>
          Extracted Pages Input
        </h2>
        <pre className='mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-(--text-main)'>
          {JSON.stringify(extractedPages, null, 2)}
        </pre>
      </section>

      <section className='rounded-2xl border border-(--border-soft) bg-(--surface-panel) p-4'>
        <h2 className='text-sm font-semibold uppercase tracking-[0.08em] text-(--text-muted)'>
          Chunk Output
        </h2>
        <pre className='mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-(--text-main)'>
          {JSON.stringify(chunks, null, 2)}
        </pre>
      </section>

      <section className='rounded-2xl border border-(--border-soft) bg-(--surface-panel) p-4'>
        <h2 className='text-sm font-semibold uppercase tracking-[0.08em] text-(--text-muted)'>
          Chunks With Embeddings
        </h2>
        <pre className='mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-(--text-main)'>
          {JSON.stringify(chunksWithEmbeddings, null, 2)}
        </pre>
      </section>
    </main>
  );
}
