/** @jest-environment node */

import { POST } from "./route";
import {
  getSupabaseServerClient,
  getSupabaseStorageBucket,
} from "@/lib/supabase-server";

jest.mock("@/lib/supabase-server", () => ({
  getSupabaseServerClient: jest.fn(),
  getSupabaseStorageBucket: jest.fn(),
}));

const mockedGetSupabaseServerClient = jest.mocked(getSupabaseServerClient);
const mockedGetSupabaseStorageBucket = jest.mocked(getSupabaseStorageBucket);

function createRequest(formData: FormData) {
  return {
    formData: async () => formData,
  } as unknown as Request;
}

describe("POST /api/uploads/pdf", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis.crypto.randomUUID as jest.Mock).mockReturnValue("file-123");
  });

  test("returns 500 when storage is not configured", async () => {
    mockedGetSupabaseServerClient.mockReturnValue(null);
    mockedGetSupabaseStorageBucket.mockReturnValue(null);

    const response = await POST(createRequest(new FormData()));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Supabase storage is not configured.",
    });
  });

  test("returns 400 when classId is missing", async () => {
    mockedGetSupabaseServerClient.mockReturnValue({} as never);
    mockedGetSupabaseStorageBucket.mockReturnValue("uploaded-pdfs");

    const formData = new FormData();
    formData.append(
      "file",
      new File(["pdf"], "notes.pdf", { type: "application/pdf" }),
    );

    const response = await POST(createRequest(formData));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Missing classId." });
  });

  test("returns 400 when file is missing", async () => {
    mockedGetSupabaseServerClient.mockReturnValue({} as never);
    mockedGetSupabaseStorageBucket.mockReturnValue("uploaded-pdfs");

    const formData = new FormData();
    formData.append("classId", "cs101-ai");

    const response = await POST(createRequest(formData));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Missing file." });
  });

  test("rejects non-pdf uploads", async () => {
    mockedGetSupabaseServerClient.mockReturnValue({} as never);
    mockedGetSupabaseStorageBucket.mockReturnValue("uploaded-pdfs");

    const formData = new FormData();
    formData.append("classId", "cs101-ai");
    formData.append("file", new File(["txt"], "notes.txt", { type: "text/plain" }));

    const response = await POST(createRequest(formData));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Only PDF files can be uploaded.",
    });
  });

  test("rejects uploads over the 50 MB limit", async () => {
    mockedGetSupabaseServerClient.mockReturnValue({} as never);
    mockedGetSupabaseStorageBucket.mockReturnValue("uploaded-pdfs");

    const file = new File(["pdf"], "big.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "size", {
      configurable: true,
      value: 50 * 1024 * 1024 + 1,
    });

    const formData = new FormData();
    formData.append("classId", "cs101-ai");
    formData.append("file", file);

    const response = await POST(createRequest(formData));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "PDF exceeds the 50 MB limit.",
    });
  });

  test("returns 500 when storage upload fails", async () => {
    const upload = jest.fn().mockResolvedValue({
      error: { message: "boom" },
    });
    const from = jest.fn().mockReturnValue({ upload });

    mockedGetSupabaseServerClient.mockReturnValue({
      storage: { from },
    } as never);
    mockedGetSupabaseStorageBucket.mockReturnValue("uploaded-pdfs");

    const formData = new FormData();
    formData.append("classId", "cs101-ai");
    formData.append(
      "file",
      new File(["pdf"], "Lesson Plan!.pdf", { type: "application/pdf" }),
    );

    const response = await POST(createRequest(formData));

    expect(from).toHaveBeenCalledWith("uploaded-pdfs");
    expect(upload).toHaveBeenCalledWith(
      "cs101-ai/file-123/lesson-plan-.pdf",
      expect.any(File),
      expect.objectContaining({
        cacheControl: "3600",
        contentType: "application/pdf",
        upsert: false,
      }),
    );
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Unable to upload PDF to Supabase Storage.",
    });
  });

  test("uploads a pdf and returns file metadata", async () => {
    const upload = jest.fn().mockResolvedValue({ error: null });
    const from = jest.fn().mockReturnValue({ upload });

    mockedGetSupabaseServerClient.mockReturnValue({
      storage: { from },
    } as never);
    mockedGetSupabaseStorageBucket.mockReturnValue("uploaded-pdfs");

    const formData = new FormData();
    formData.append("classId", "cs101-ai");
    formData.append(
      "file",
      new File(["pdf"], "Lesson Plan!.pdf", { type: "application/pdf" }),
    );

    const response = await POST(createRequest(formData));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      fileId: "file-123",
      mimeType: "application/pdf",
      size: 3,
      storagePath: "cs101-ai/file-123/lesson-plan-.pdf",
      title: "Lesson Plan!.pdf",
    });
  });
});
