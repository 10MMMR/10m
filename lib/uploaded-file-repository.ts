export type UploadedPdf = {
  id: string;
  class: string;
  name: string;
  size: number;
  mimeType: string;
  dataUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type UploadedPdfChildFile = {
  id: string;
  pdfId: string;
  class: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export interface UploadedFileRepository {
  listPdfsByClass(classId: string): UploadedPdf[];
  getPdfById(classId: string, pdfId: string): UploadedPdf | null;
  savePdf(pdf: UploadedPdf): void;
  deletePdfById(classId: string, pdfId: string): void;
  listChildFilesByClass(classId: string): UploadedPdfChildFile[];
  listChildFilesByPdf(classId: string, pdfId: string): UploadedPdfChildFile[];
  getChildFileById(
    classId: string,
    childFileId: string,
  ): UploadedPdfChildFile | null;
  saveChildFile(file: UploadedPdfChildFile): void;
  deleteChildFileById(classId: string, childFileId: string): void;
}

const PDF_STORAGE_KEY = "10m.uploaded-pdfs.v1";
const CHILD_FILE_STORAGE_KEY = "10m.uploaded-pdf-children.v1";

function isUploadedPdf(value: unknown): value is UploadedPdf {
  if (!value || typeof value !== "object") {
    return false;
  }

  const pdf = value as Record<string, unknown>;

  return (
    typeof pdf.id === "string" &&
    typeof pdf.class === "string" &&
    typeof pdf.name === "string" &&
    typeof pdf.size === "number" &&
    typeof pdf.mimeType === "string" &&
    typeof pdf.dataUrl === "string" &&
    typeof pdf.createdAt === "string" &&
    typeof pdf.updatedAt === "string"
  );
}

function isUploadedPdfChildFile(value: unknown): value is UploadedPdfChildFile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const file = value as Record<string, unknown>;

  return (
    typeof file.id === "string" &&
    typeof file.pdfId === "string" &&
    typeof file.class === "string" &&
    typeof file.title === "string" &&
    typeof file.body === "string" &&
    typeof file.createdAt === "string" &&
    typeof file.updatedAt === "string"
  );
}

function sortByUpdatedAt<T extends { updatedAt: string }>(items: T[]): T[] {
  return [...items].sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
  );
}

export class LocalStorageUploadedFileRepository implements UploadedFileRepository {
  private readStorage<T>(
    storageKey: string,
    validator: (value: unknown) => value is T,
  ): T[] {
    if (typeof window === "undefined") {
      return [];
    }

    const raw = window.localStorage.getItem(storageKey);

    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter(validator);
    } catch {
      return [];
    }
  }

  private writeStorage(storageKey: string, records: unknown[]) {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(records));
  }

  private readAllPdfs() {
    return this.readStorage(PDF_STORAGE_KEY, isUploadedPdf);
  }

  private writeAllPdfs(pdfs: UploadedPdf[]) {
    this.writeStorage(PDF_STORAGE_KEY, pdfs);
  }

  private readAllChildFiles() {
    return this.readStorage(CHILD_FILE_STORAGE_KEY, isUploadedPdfChildFile);
  }

  private writeAllChildFiles(files: UploadedPdfChildFile[]) {
    this.writeStorage(CHILD_FILE_STORAGE_KEY, files);
  }

  listPdfsByClass(classId: string): UploadedPdf[] {
    const pdfs = this.readAllPdfs().filter((pdf) => pdf.class === classId);
    return sortByUpdatedAt(pdfs);
  }

  getPdfById(classId: string, pdfId: string): UploadedPdf | null {
    const pdf = this.readAllPdfs().find(
      (item) => item.class === classId && item.id === pdfId,
    );

    return pdf ?? null;
  }

  savePdf(pdf: UploadedPdf): void {
    const pdfs = this.readAllPdfs();
    const index = pdfs.findIndex(
      (item) => item.class === pdf.class && item.id === pdf.id,
    );

    if (index >= 0) {
      pdfs[index] = pdf;
    } else {
      pdfs.push(pdf);
    }

    this.writeAllPdfs(pdfs);
  }

  deletePdfById(classId: string, pdfId: string): void {
    const remainingPdfs = this.readAllPdfs().filter(
      (pdf) => !(pdf.class === classId && pdf.id === pdfId),
    );

    const remainingChildFiles = this.readAllChildFiles().filter(
      (file) => !(file.class === classId && file.pdfId === pdfId),
    );

    this.writeAllPdfs(remainingPdfs);
    this.writeAllChildFiles(remainingChildFiles);
  }

  listChildFilesByClass(classId: string): UploadedPdfChildFile[] {
    const files = this.readAllChildFiles().filter((file) => file.class === classId);
    return sortByUpdatedAt(files);
  }

  listChildFilesByPdf(classId: string, pdfId: string): UploadedPdfChildFile[] {
    const files = this.readAllChildFiles().filter(
      (file) => file.class === classId && file.pdfId === pdfId,
    );

    return sortByUpdatedAt(files);
  }

  getChildFileById(classId: string, childFileId: string): UploadedPdfChildFile | null {
    const file = this.readAllChildFiles().find(
      (item) => item.class === classId && item.id === childFileId,
    );

    return file ?? null;
  }

  saveChildFile(file: UploadedPdfChildFile): void {
    const files = this.readAllChildFiles();
    const index = files.findIndex(
      (item) => item.class === file.class && item.id === file.id,
    );

    if (index >= 0) {
      files[index] = file;
    } else {
      files.push(file);
    }

    this.writeAllChildFiles(files);
  }

  deleteChildFileById(classId: string, childFileId: string): void {
    const files = this.readAllChildFiles().filter(
      (file) => !(file.class === classId && file.id === childFileId),
    );

    this.writeAllChildFiles(files);
  }
}

export function createDraftUploadedPdfChildFile(
  classId: string,
  pdfId: string,
): UploadedPdfChildFile {
  const timestamp = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    pdfId,
    class: classId,
    title: "Untitled file",
    body: "<p></p>",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function cloneUploadedPdfChildFile(
  file: UploadedPdfChildFile,
): UploadedPdfChildFile {
  return {
    id: file.id,
    pdfId: file.pdfId,
    class: file.class,
    title: file.title,
    body: file.body,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  };
}
