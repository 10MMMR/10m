/** @jest-environment node */

import { DELETE, GET } from "./route";
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

describe("/api/storage/pdf", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET returns 500 when storage is not configured", async () => {
    mockedGetSupabaseServerClient.mockReturnValue(null);
    mockedGetSupabaseStorageBucket.mockReturnValue(null);

    const response = await GET(
      new Request("http://localhost/api/storage/pdf?path=test.pdf"),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Supabase storage is not configured.",
    });
  });

  test("GET returns 400 when path is missing", async () => {
    mockedGetSupabaseServerClient.mockReturnValue({} as never);
    mockedGetSupabaseStorageBucket.mockReturnValue("uploaded-pdfs");

    const response = await GET(new Request("http://localhost/api/storage/pdf"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing storage path.",
    });
  });

  test("GET returns 404 when the pdf cannot be downloaded", async () => {
    const download = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "missing" },
    });
    const from = jest.fn().mockReturnValue({ download });

    mockedGetSupabaseServerClient.mockReturnValue({
      storage: { from },
    } as never);
    mockedGetSupabaseStorageBucket.mockReturnValue("uploaded-pdfs");

    const response = await GET(
      new Request("http://localhost/api/storage/pdf?path=class/file.pdf"),
    );

    expect(download).toHaveBeenCalledWith("class/file.pdf");
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "PDF not found." });
  });

  test("GET returns the pdf blob with headers", async () => {
    const download = jest.fn().mockResolvedValue({
      data: new Blob(["pdf"], { type: "application/pdf" }),
      error: null,
    });
    const from = jest.fn().mockReturnValue({ download });

    mockedGetSupabaseServerClient.mockReturnValue({
      storage: { from },
    } as never);
    mockedGetSupabaseStorageBucket.mockReturnValue("uploaded-pdfs");

    const response = await GET(
      new Request("http://localhost/api/storage/pdf?path=class/file.pdf"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=3600");
    await expect(response.text()).resolves.toBe("pdf");
  });

  test("DELETE returns 400 when path is missing", async () => {
    mockedGetSupabaseServerClient.mockReturnValue({} as never);
    mockedGetSupabaseStorageBucket.mockReturnValue("uploaded-pdfs");

    const response = await DELETE(new Request("http://localhost/api/storage/pdf"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing storage path.",
    });
  });

  test("DELETE returns 500 when remove fails", async () => {
    const remove = jest.fn().mockResolvedValue({
      error: { message: "fail" },
    });
    const from = jest.fn().mockReturnValue({ remove });

    mockedGetSupabaseServerClient.mockReturnValue({
      storage: { from },
    } as never);
    mockedGetSupabaseStorageBucket.mockReturnValue("uploaded-pdfs");

    const response = await DELETE(
      new Request("http://localhost/api/storage/pdf?path=class/file.pdf"),
    );

    expect(remove).toHaveBeenCalledWith(["class/file.pdf"]);
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Unable to delete PDF from Supabase Storage.",
    });
  });

  test("DELETE removes the pdf and returns ok", async () => {
    const remove = jest.fn().mockResolvedValue({ error: null });
    const from = jest.fn().mockReturnValue({ remove });

    mockedGetSupabaseServerClient.mockReturnValue({
      storage: { from },
    } as never);
    mockedGetSupabaseStorageBucket.mockReturnValue("uploaded-pdfs");

    const response = await DELETE(
      new Request("http://localhost/api/storage/pdf?path=class/file.pdf"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
