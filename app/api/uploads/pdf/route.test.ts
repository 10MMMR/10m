/** @jest-environment node */

import { DELETE, POST } from "./route";
import { SupabaseTreeRepository } from "@/lib/supabase-tree-repository";
import {
  getSupabaseServerClient,
  getSupabaseStorageBucket,
} from "@/lib/supabase-server";

jest.mock("@/lib/supabase-server", () => ({
  getSupabaseServerClient: jest.fn(),
  getSupabaseStorageBucket: jest.fn(),
}));

jest.mock("@/lib/supabase-tree-repository", () => ({
  SupabaseTreeRepository: jest.fn(),
}));

const mockedGetSupabaseServerClient = jest.mocked(getSupabaseServerClient);
const mockedGetSupabaseStorageBucket = jest.mocked(getSupabaseStorageBucket);
const MockedSupabaseTreeRepository = jest.mocked(SupabaseTreeRepository);

function createRequest(
  {
    authorization,
    formData,
    json,
  }: {
    authorization?: string;
    formData?: FormData;
    json?: unknown;
  } = {},
) {
  return {
    formData: async () => formData ?? new FormData(),
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "authorization" ? authorization ?? null : null,
    },
    json: async () => json,
  } as unknown as Request;
}

function createSupabaseMock() {
  const upload = jest.fn().mockResolvedValue({ error: null });
  const remove = jest.fn().mockResolvedValue({ error: null });
  const from = jest.fn().mockReturnValue({
    remove,
    upload,
  });
  const getUser = jest.fn().mockResolvedValue({
    data: {
      user: {
        id: "user-123",
      },
    },
    error: null,
  });

  return {
    auth: { getUser },
    storage: { from },
  };
}

describe("/api/uploads/pdf", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetSupabaseStorageBucket.mockReturnValue("uploaded-pdfs");
    (globalThis.crypto.randomUUID as jest.Mock).mockReturnValue("file-123");
  });

  test("POST rejects unauthenticated uploads", async () => {
    mockedGetSupabaseServerClient.mockReturnValue(createSupabaseMock() as never);

    const response = await POST(createRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized.",
    });
  });

  test("POST rejects invalid classId", async () => {
    mockedGetSupabaseServerClient.mockReturnValue(createSupabaseMock() as never);

    const formData = new FormData();
    formData.append("classId", "%%%");
    formData.append("parentId", "root:cs101-ai");
    formData.append("file", new File(["pdf"], "notes.pdf", { type: "application/pdf" }));

    const response = await POST(
      createRequest({
        authorization: "Bearer token-123",
        formData,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid classId." });
  });

  test("POST rejects missing parentId", async () => {
    mockedGetSupabaseServerClient.mockReturnValue(createSupabaseMock() as never);

    const formData = new FormData();
    formData.append("classId", "cs101-ai");
    formData.append("file", new File(["pdf"], "notes.pdf", { type: "application/pdf" }));

    const response = await POST(
      createRequest({
        authorization: "Bearer token-123",
        formData,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Missing parentId." });
  });

  test("POST rejects invalid parentId format", async () => {
    mockedGetSupabaseServerClient.mockReturnValue(createSupabaseMock() as never);

    const formData = new FormData();
    formData.append("classId", "cs101-ai");
    formData.append("parentId", "../root");
    formData.append("file", new File(["pdf"], "notes.pdf", { type: "application/pdf" }));

    const response = await POST(
      createRequest({
        authorization: "Bearer token-123",
        formData,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Missing parentId." });
  });

  test("POST rejects missing file", async () => {
    mockedGetSupabaseServerClient.mockReturnValue(createSupabaseMock() as never);

    const formData = new FormData();
    formData.append("classId", "cs101-ai");
    formData.append("parentId", "root:cs101-ai");

    const response = await POST(
      createRequest({
        authorization: "Bearer token-123",
        formData,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Missing file." });
  });

  test("POST rejects non-pdf uploads", async () => {
    mockedGetSupabaseServerClient.mockReturnValue(createSupabaseMock() as never);

    const formData = new FormData();
    formData.append("classId", "cs101-ai");
    formData.append("parentId", "root:cs101-ai");
    formData.append("file", new File(["txt"], "notes.txt", { type: "text/plain" }));

    const response = await POST(
      createRequest({
        authorization: "Bearer token-123",
        formData,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Only PDF files can be uploaded.",
    });
  });

  test("POST rejects uploads over the 50 MB limit", async () => {
    mockedGetSupabaseServerClient.mockReturnValue(createSupabaseMock() as never);

    const file = new File(["pdf"], "big.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "size", {
      configurable: true,
      value: 50 * 1024 * 1024 + 1,
    });

    const formData = new FormData();
    formData.append("classId", "cs101-ai");
    formData.append("parentId", "root:cs101-ai");
    formData.append("file", file);

    const response = await POST(
      createRequest({
        authorization: "Bearer token-123",
        formData,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "PDF exceeds the 50 MB limit.",
    });
  });

  test("POST rejects a parent that cannot contain files", async () => {
    const supabase = createSupabaseMock();
    mockedGetSupabaseServerClient.mockReturnValue(supabase as never);
    MockedSupabaseTreeRepository.mockImplementation(
      () =>
        ({
          listTreeByClass: jest.fn().mockResolvedValue([
            {
              classId: "cs101-ai",
              createdAt: "2026-04-01T00:00:00.000Z",
              id: "root:cs101-ai",
              kind: "root",
              order: 0,
              parentId: null,
              title: "cs101-ai",
              updatedAt: "2026-04-01T00:00:00.000Z",
            },
            {
              classId: "cs101-ai",
              createdAt: "2026-04-02T00:00:00.000Z",
              fileMimeType: "application/pdf",
              fileSize: 3,
              fileStoragePath: "user-123/cs101-ai/file-node/lecture.pdf",
              id: "file-node",
              kind: "file",
              order: 1,
              parentId: "root:cs101-ai",
              title: "lecture.pdf",
              updatedAt: "2026-04-02T00:00:00.000Z",
            },
          ]),
          replaceTree: jest.fn(),
        }) as never,
    );

    const formData = new FormData();
    formData.append("classId", "cs101-ai");
    formData.append("parentId", "file-node");
    formData.append("file", new File(["pdf"], "notes.pdf", { type: "application/pdf" }));

    const response = await POST(
      createRequest({
        authorization: "Bearer token-123",
        formData,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Parent node cannot contain files.",
    });
  });

  test("POST rejects a well-formed but unknown parentId", async () => {
    const supabase = createSupabaseMock();
    const replaceTree = jest.fn();
    mockedGetSupabaseServerClient.mockReturnValue(supabase as never);
    MockedSupabaseTreeRepository.mockImplementation(
      () =>
        ({
          listTreeByClass: jest.fn().mockResolvedValue([
            {
              classId: "cs101-ai",
              createdAt: "2026-04-01T00:00:00.000Z",
              id: "root:cs101-ai",
              kind: "root",
              order: 0,
              parentId: null,
              title: "cs101-ai",
              updatedAt: "2026-04-01T00:00:00.000Z",
            },
          ]),
          replaceTree,
        }) as never,
    );

    const formData = new FormData();
    formData.append("classId", "cs101-ai");
    formData.append("parentId", "folder-unknown");
    formData.append("file", new File(["pdf"], "notes.pdf", { type: "application/pdf" }));

    const response = await POST(
      createRequest({
        authorization: "Bearer token-123",
        formData,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid parentId." });
    expect(supabase.storage.from().upload).not.toHaveBeenCalled();
    expect(replaceTree).not.toHaveBeenCalled();
  });

  test("POST sanitizes filename, scopes storage path to the user, and returns saved tree", async () => {
    const supabase = createSupabaseMock();
    mockedGetSupabaseServerClient.mockReturnValue(supabase as never);
    MockedSupabaseTreeRepository.mockImplementation(
      () =>
        ({
          listTreeByClass: jest.fn().mockResolvedValue([
            {
              classId: "cs101-ai",
              createdAt: "2026-04-01T00:00:00.000Z",
              id: "root:cs101-ai",
              kind: "root",
              order: 0,
              parentId: null,
              title: "cs101-ai",
              updatedAt: "2026-04-01T00:00:00.000Z",
            },
          ]),
          replaceTree: jest.fn().mockResolvedValue([
            {
              classId: "cs101-ai",
              createdAt: "2026-04-01T00:00:00.000Z",
              id: "root:cs101-ai",
              kind: "root",
              order: 0,
              parentId: null,
              title: "cs101-ai",
              updatedAt: "2026-04-01T00:00:00.000Z",
            },
            {
              classId: "cs101-ai",
              createdAt: "2026-04-02T00:00:00.000Z",
              fileMimeType: "application/pdf",
              fileSize: 3,
              fileStoragePath: "user-123/cs101-ai/file-123/lesson-plan-.pdf",
              id: "file-123",
              kind: "file",
              order: 0,
              parentId: "root:cs101-ai",
              title: "Lesson Plan!.pdf",
              updatedAt: "2026-04-02T00:00:00.000Z",
            },
          ]),
        }) as never,
    );

    const formData = new FormData();
    formData.append("classId", "cs101-ai");
    formData.append("parentId", "root:cs101-ai");
    formData.append(
      "file",
      new File(["pdf"], "Lesson Plan!.pdf", { type: "application/pdf" }),
    );

    const response = await POST(
      createRequest({
        authorization: "Bearer token-123",
        formData,
      }),
    );

    expect(supabase.storage.from).toHaveBeenCalledWith("uploaded-pdfs");
    expect(supabase.storage.from().upload).toHaveBeenCalledWith(
      "user-123/cs101-ai/file-123/lesson-plan-.pdf",
      expect.any(File),
      expect.objectContaining({
        cacheControl: "3600",
        contentType: "application/pdf",
        upsert: false,
      }),
    );
    expect(MockedSupabaseTreeRepository).toHaveBeenCalledWith(supabase, "user-123");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      fileNode: expect.objectContaining({
        fileStoragePath: "user-123/cs101-ai/file-123/lesson-plan-.pdf",
        id: "file-123",
      }),
      tree: expect.any(Array),
    });
  });

  test("POST rolls back the storage object when tree persistence fails", async () => {
    const supabase = createSupabaseMock();
    mockedGetSupabaseServerClient.mockReturnValue(supabase as never);
    MockedSupabaseTreeRepository.mockImplementation(
      () =>
        ({
          listTreeByClass: jest.fn().mockResolvedValue([
            {
              classId: "cs101-ai",
              createdAt: "2026-04-01T00:00:00.000Z",
              id: "root:cs101-ai",
              kind: "root",
              order: 0,
              parentId: null,
              title: "cs101-ai",
              updatedAt: "2026-04-01T00:00:00.000Z",
            },
          ]),
          replaceTree: jest.fn().mockRejectedValue(new Error("db failed")),
        }) as never,
    );

    const formData = new FormData();
    formData.append("classId", "cs101-ai");
    formData.append("parentId", "root:cs101-ai");
    formData.append("file", new File(["pdf"], "notes.pdf", { type: "application/pdf" }));

    const response = await POST(
      createRequest({
        authorization: "Bearer token-123",
        formData,
      }),
    );

    expect(supabase.storage.from().remove).toHaveBeenCalledWith([
      "user-123/cs101-ai/file-123/notes.pdf",
    ]);
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "db failed",
    });
  });

  test("DELETE rejects unauthenticated requests", async () => {
    mockedGetSupabaseServerClient.mockReturnValue(createSupabaseMock() as never);

    const response = await DELETE(createRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized.",
    });
  });

  test("DELETE rejects invalid nodeIds payloads", async () => {
    mockedGetSupabaseServerClient.mockReturnValue(createSupabaseMock() as never);

    const response = await DELETE(
      createRequest({
        authorization: "Bearer token-123",
        json: {
          classId: "cs101-ai",
          nodeIds: ["valid-id", "../bad-id"],
        },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid nodeIds.",
    });
  });

  test("DELETE deduplicates nodeIds before deleting", async () => {
    const supabase = createSupabaseMock();
    mockedGetSupabaseServerClient.mockReturnValue(supabase as never);
    const replaceTree = jest.fn().mockResolvedValue([
      {
        classId: "cs101-ai",
        createdAt: "2026-04-01T00:00:00.000Z",
        id: "root:cs101-ai",
        kind: "root",
        order: 0,
        parentId: null,
        title: "cs101-ai",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
    ]);
    MockedSupabaseTreeRepository.mockImplementation(
      () =>
        ({
          listTreeByClass: jest.fn().mockResolvedValue([
            {
              classId: "cs101-ai",
              createdAt: "2026-04-01T00:00:00.000Z",
              id: "root:cs101-ai",
              kind: "root",
              order: 0,
              parentId: null,
              title: "cs101-ai",
              updatedAt: "2026-04-01T00:00:00.000Z",
            },
            {
              classId: "cs101-ai",
              createdAt: "2026-04-02T00:00:00.000Z",
              fileMimeType: "application/pdf",
              fileSize: 3,
              fileStoragePath: "user-123/cs101-ai/file-123/lecture.pdf",
              id: "file-123",
              kind: "file",
              order: 0,
              parentId: "root:cs101-ai",
              title: "lecture.pdf",
              updatedAt: "2026-04-02T00:00:00.000Z",
            },
          ]),
          replaceTree,
        }) as never,
    );

    const response = await DELETE(
      createRequest({
        authorization: "Bearer token-123",
        json: {
          classId: "cs101-ai",
          nodeIds: ["file-123", "file-123"],
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(replaceTree).toHaveBeenCalledTimes(1);
    expect(supabase.storage.from().remove).toHaveBeenCalledWith([
      "user-123/cs101-ai/file-123/lecture.pdf",
    ]);
  });

  test("DELETE computes storage paths from repository state instead of client input", async () => {
    const supabase = createSupabaseMock();
    mockedGetSupabaseServerClient.mockReturnValue(supabase as never);
    MockedSupabaseTreeRepository.mockImplementation(
      () =>
        ({
          listTreeByClass: jest.fn().mockResolvedValue([
            {
              classId: "cs101-ai",
              createdAt: "2026-04-01T00:00:00.000Z",
              id: "root:cs101-ai",
              kind: "root",
              order: 0,
              parentId: null,
              title: "cs101-ai",
              updatedAt: "2026-04-01T00:00:00.000Z",
            },
            {
              classId: "cs101-ai",
              createdAt: "2026-04-02T00:00:00.000Z",
              fileMimeType: "application/pdf",
              fileSize: 3,
              fileStoragePath: "user-123/cs101-ai/file-123/lecture.pdf",
              id: "file-123",
              kind: "file",
              order: 0,
              parentId: "root:cs101-ai",
              title: "lecture.pdf",
              updatedAt: "2026-04-02T00:00:00.000Z",
            },
          ]),
          replaceTree: jest.fn().mockResolvedValue([
            {
              classId: "cs101-ai",
              createdAt: "2026-04-01T00:00:00.000Z",
              id: "root:cs101-ai",
              kind: "root",
              order: 0,
              parentId: null,
              title: "cs101-ai",
              updatedAt: "2026-04-01T00:00:00.000Z",
            },
          ]),
        }) as never,
    );

    const response = await DELETE(
      createRequest({
        authorization: "Bearer token-123",
        json: {
          classId: "cs101-ai",
          nodeIds: ["file-123"],
          path: "malicious/path.pdf",
        },
      }),
    );

    expect(supabase.storage.from().remove).toHaveBeenCalledWith([
      "user-123/cs101-ai/file-123/lecture.pdf",
    ]);
    expect(response.status).toBe(200);
  });

  test("DELETE reports partial failure when storage cleanup fails after tree update", async () => {
    const supabase = createSupabaseMock();
    supabase.storage.from().remove.mockResolvedValue({
      error: { message: "remove failed" },
    });
    mockedGetSupabaseServerClient.mockReturnValue(supabase as never);
    MockedSupabaseTreeRepository.mockImplementation(
      () =>
        ({
          listTreeByClass: jest.fn().mockResolvedValue([
            {
              classId: "cs101-ai",
              createdAt: "2026-04-01T00:00:00.000Z",
              id: "root:cs101-ai",
              kind: "root",
              order: 0,
              parentId: null,
              title: "cs101-ai",
              updatedAt: "2026-04-01T00:00:00.000Z",
            },
            {
              classId: "cs101-ai",
              createdAt: "2026-04-02T00:00:00.000Z",
              fileMimeType: "application/pdf",
              fileSize: 3,
              fileStoragePath: "user-123/cs101-ai/file-123/lecture.pdf",
              id: "file-123",
              kind: "file",
              order: 0,
              parentId: "root:cs101-ai",
              title: "lecture.pdf",
              updatedAt: "2026-04-02T00:00:00.000Z",
            },
          ]),
          replaceTree: jest.fn().mockResolvedValue([
            {
              classId: "cs101-ai",
              createdAt: "2026-04-01T00:00:00.000Z",
              id: "root:cs101-ai",
              kind: "root",
              order: 0,
              parentId: null,
              title: "cs101-ai",
              updatedAt: "2026-04-01T00:00:00.000Z",
            },
          ]),
        }) as never,
    );

    const response = await DELETE(
      createRequest({
        authorization: "Bearer token-123",
        json: {
          classId: "cs101-ai",
          nodeIds: ["file-123"],
        },
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Tree updated, but failed to remove one or more PDFs from storage.",
      orphanedPaths: ["user-123/cs101-ai/file-123/lecture.pdf"],
      tree: expect.any(Array),
      treeUpdated: true,
    });
  });
});
