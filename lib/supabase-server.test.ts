import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "./supabase-server";

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(),
}));

const mockedCreateClient = jest.mocked(createClient);

describe("createSupabaseServerClient", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("returns null when required config is missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(createSupabaseServerClient("token-123")).toBeNull();
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  test("creates a new request-scoped client with anon auth and bearer header", () => {
    const firstClient = { kind: "first" };
    const secondClient = { kind: "second" };
    mockedCreateClient
      .mockReturnValueOnce(firstClient as never)
      .mockReturnValueOnce(secondClient as never);

    const firstResult = createSupabaseServerClient("token-123");
    const secondResult = createSupabaseServerClient("token-456");

    expect(firstResult).toBe(firstClient);
    expect(secondResult).toBe(secondClient);
    expect(mockedCreateClient).toHaveBeenNthCalledWith(
      1,
      "https://example.supabase.co",
      "anon-key",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          headers: {
            Authorization: "Bearer token-123",
          },
        },
      },
    );
    expect(mockedCreateClient).toHaveBeenNthCalledWith(
      2,
      "https://example.supabase.co",
      "anon-key",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          headers: {
            Authorization: "Bearer token-456",
          },
        },
      },
    );
  });
});
