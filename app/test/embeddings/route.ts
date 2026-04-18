import OpenAI from "openai";
import { NextResponse } from "next/server";

type EmbeddingsRequestBody = {
  chunks?: unknown;
};

function getOpenAiApiKey() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  return apiKey;
}

function parseChunks(body: EmbeddingsRequestBody) {
  if (!Array.isArray(body.chunks)) {
    throw new Error("chunks must be an array of strings.");
  }

  const chunks = body.chunks
    .filter((chunk): chunk is string => typeof chunk === "string")
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (chunks.length === 0) {
    throw new Error("At least one chunk is required.");
  }

  return chunks;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EmbeddingsRequestBody;
    const chunks = parseChunks(body);
    const client = new OpenAI({
      apiKey: getOpenAiApiKey(),
    });

    const embeddings: number[][] = [];

    for (const chunk of chunks) {
      const response = await client.embeddings.create({
        model: "text-embedding-3-small",
        input: chunk,
      });

      embeddings.push(response.data[0]?.embedding ?? []);
    }

    return NextResponse.json({ embeddings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate embeddings.";
    const statusCode =
      message === "chunks must be an array of strings." ||
      message === "At least one chunk is required."
        ? 400
        : 500;

    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
