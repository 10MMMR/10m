"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/app/_global/authentication/supabaseClient";

export type PdfReference = {
  classId: string;
  materialId: string;
  page: number | null;
  title: string;
};

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type PdfDocumentProxy = Awaited<ReturnType<PdfJsModule["getDocument"]>["promise"]>;

const CLASS_MATERIALS_BUCKET = "class_materials";

let pdfJsPromise: Promise<PdfJsModule> | null = null;

const loadPdfJs = async () => {
  if (!pdfJsPromise) {
    pdfJsPromise = import("pdfjs-dist/legacy/build/pdf.mjs");
  }

  return pdfJsPromise;
};

async function findPdfInStorageFolder(folderPath: string) {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(CLASS_MATERIALS_BUCKET)
    .list(folderPath, { limit: 20 });

  if (error || !Array.isArray(data)) {
    return null;
  }

  const file = data.find((item) => item.name.toLowerCase().endsWith(".pdf"));

  return file?.name ? `${folderPath}/${file.name}` : null;
}

async function resolveMaterialPdfPath(reference: PdfReference, userId?: string | null) {
  const classMaterialPath = await findPdfInStorageFolder(
    `${reference.classId}/${reference.materialId}`,
  );

  if (classMaterialPath) {
    return classMaterialPath;
  }

  if (!supabase) {
    return null;
  }

  const { data } = await supabase
    .from("materials")
    .select("filepath")
    .eq("id", reference.materialId)
    .eq("class_id", reference.classId)
    .maybeSingle();
  const filepath = (data as { filepath?: unknown } | null)?.filepath;

  if (typeof filepath === "string" && filepath.trim().length > 0) {
    return filepath.trim();
  }

  if (!userId) {
    return null;
  }

  return findPdfInStorageFolder(`${userId}/${reference.materialId}`);
}

function PdfCanvasViewer({
  initialPage,
  sourceUrl,
}: {
  initialPage: number;
  sourceUrl: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const documentRef = useRef<PdfDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);

  useEffect(() => {
    let ignore = false;

    const loadDocument = async () => {
      setRenderError(null);
      setIsRendering(true);
      setPageCount(null);

      try {
        const pdfJs = await loadPdfJs();
        const { getDocument, GlobalWorkerOptions } = pdfJs;
        GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const pdf = await getDocument({ url: sourceUrl }).promise;

        if (ignore) {
          await pdf.destroy();
          return;
        }

        documentRef.current = pdf;
        const nextPage = Math.min(Math.max(initialPage, 1), pdf.numPages);
        setCurrentPage(nextPage);
        setPageCount(pdf.numPages);
      } catch {
        if (!ignore) {
          setRenderError("Unable to open this PDF.");
          setIsRendering(false);
        }
      }
    };

    void loadDocument();

    return () => {
      ignore = true;
      const document = documentRef.current;
      documentRef.current = null;
      void document?.destroy();
    };
  }, [initialPage, sourceUrl]);

  useEffect(() => {
    const document = documentRef.current;
    const canvas = canvasRef.current;

    if (!document || !canvas) {
      return;
    }

    let ignore = false;

    const renderPage = async () => {
      setRenderError(null);
      setIsRendering(true);

      try {
        const page = await document.getPage(currentPage);
        const viewport = page.getViewport({ scale: 1.35 });
        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("Canvas is unavailable.");
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        await page.render({ canvas, canvasContext: context, viewport }).promise;

        if (!ignore) {
          setIsRendering(false);
        }
      } catch {
        if (!ignore) {
          setRenderError("Unable to render this page.");
          setIsRendering(false);
        }
      }
    };

    void renderPage();

    return () => {
      ignore = true;
    };
  }, [currentPage, pageCount]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-(--border-soft) px-4 py-3">
        <button
          aria-label="Previous page"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-(--border-soft) bg-(--surface-base) text-(--text-main) transition-colors duration-200 hover:bg-(--surface-main-faint) disabled:cursor-not-allowed disabled:opacity-50"
          disabled={currentPage <= 1}
          onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
          type="button"
        >
          <ArrowLeftIcon aria-hidden="true" className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold text-(--text-main)">
          Page {currentPage}
          {pageCount ? ` / ${pageCount}` : ""}
        </p>
        <button
          aria-label="Next page"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-(--border-soft) bg-(--surface-base) text-(--text-main) transition-colors duration-200 hover:bg-(--surface-main-faint) disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pageCount !== null && currentPage >= pageCount}
          onClick={() =>
            setCurrentPage((page) =>
              pageCount ? Math.min(pageCount, page + 1) : page + 1,
            )
          }
          type="button"
        >
          <ArrowRightIcon aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      <div className="relative min-h-0 flex-1 overflow-auto bg-(--surface-main-faint) p-4">
        {isRendering ? (
          <div className="absolute inset-x-0 top-4 z-10 mx-auto w-fit rounded-full border border-(--border-soft) bg-(--surface-base) px-3 py-1.5 text-xs font-semibold text-(--text-muted) shadow-(--shadow-floating)">
            Loading page...
          </div>
        ) : null}
        {renderError ? (
          <div className="flex h-full items-center justify-center text-sm font-semibold text-(--destructive)">
            {renderError}
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="mx-auto max-w-full rounded-lg bg-(--surface-base) shadow-(--shadow-floating)"
          />
        )}
      </div>
    </div>
  );
}

export function PdfReferenceModal({
  onClose,
  reference,
  userId,
}: {
  onClose: () => void;
  reference: PdfReference;
  userId?: string | null;
}) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    let objectUrl: string | null = null;

    const loadPdf = async () => {
      setPdfUrl(null);
      setLoadError(null);

      try {
        if (!supabase) {
          throw new Error("Supabase is unavailable.");
        }

        const storagePath = await resolveMaterialPdfPath(reference, userId);

        if (!storagePath) {
          throw new Error("PDF not found.");
        }

        const { data, error } = await supabase.storage
          .from(CLASS_MATERIALS_BUCKET)
          .download(storagePath);

        if (error || !data) {
          throw new Error("Unable to download PDF.");
        }

        objectUrl = URL.createObjectURL(data);

        if (ignore) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        setPdfUrl(objectUrl);
      } catch {
        if (!ignore) {
          setLoadError("Unable to load this PDF reference.");
        }
      }
    };

    void loadPdf();

    return () => {
      ignore = true;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [reference, userId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--overlay-scrim) p-3 backdrop-blur-sm">
      <section className="flex h-5/6 w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-(--border-floating) bg-(--surface-base) shadow-(--shadow-floating)">
        <header className="flex items-center justify-between gap-4 border-b border-(--border-soft) px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-(--text-main)">
              {reference.title}
            </p>
            <p className="text-xs font-semibold text-(--text-muted)">
              {reference.page ? `Opening page ${reference.page}` : "Opening PDF"}
            </p>
          </div>
          <button
            aria-label="Close PDF reference"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-(--border-soft) bg-(--surface-base) text-(--text-main) transition-colors duration-200 hover:bg-(--surface-main-faint)"
            onClick={onClose}
            type="button"
          >
            <XMarkIcon aria-hidden="true" className="h-5 w-5" />
          </button>
        </header>
        {loadError ? (
          <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm font-semibold text-(--destructive)">
            {loadError}
          </div>
        ) : pdfUrl ? (
          <PdfCanvasViewer
            initialPage={reference.page ?? 1}
            sourceUrl={pdfUrl}
          />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm font-semibold text-(--text-muted)">
            Loading PDF...
          </div>
        )}
      </section>
    </div>
  );
}
