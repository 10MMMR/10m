import type { RateLimitConfig } from "@/lib/api/rate-limit";

export const API_RATE_LIMITS = {
  chatPost: {
    key: "api:chat:post",
    limit: 5,
    windowMs: 60_000,
  },
  editorLogInvalidDocumentPost: {
    key: "api:editor:log-invalid-document:post",
    limit: 8,
    windowMs: 60_000,
  },
  notesGeneratePost: {
    key: "api:notes:generate:post",
    limit: 5,
    windowMs: 60_000,
  },
  uploadsImagePost: {
    key: "api:uploads:image:post",
    limit: 20,
    windowMs: 60_000,
  },
  uploadsPdfDelete: {
    key: "api:uploads:pdf:delete",
    limit: 30,
    windowMs: 60_000,
  },
  uploadsPdfPatch: {
    key: "api:uploads:pdf:patch",
    limit: 30,
    windowMs: 60_000,
  },
  uploadsPdfPost: {
    key: "api:uploads:pdf:post",
    limit: 12,
    windowMs: 60_000,
  },
} satisfies Record<string, RateLimitConfig>;
