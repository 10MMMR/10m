import { getAiConfig } from "../config";
import type { AiGenerateTextInput, AiPart, AiProvider } from "../types";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

function getGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  return apiKey;
}

function toGeminiRole(role: "user" | "assistant") {
  return role === "assistant" ? "model" : "user";
}

function toGeminiPart(part: AiPart) {
  if ("text" in part) {
    return { text: part.text };
  }

  return {
    inlineData: {
      mimeType: part.inlineData.mimeType,
      data: part.inlineData.data,
    },
  };
}

function buildGeminiRequestBody(input: AiGenerateTextInput) {
  return {
    contents: input.messages.map((message) => ({
      role: toGeminiRole(message.role),
      parts: message.parts.map(toGeminiPart),
    })),
    ...(input.systemInstruction
      ? {
          systemInstruction: {
            parts: [{ text: input.systemInstruction }],
          },
        }
      : {}),
    ...(input.responseMimeType || input.responseJsonSchema
      ? {
          generationConfig: {
            ...(input.responseMimeType
              ? { responseMimeType: input.responseMimeType }
              : {}),
            ...(input.responseJsonSchema
              ? { responseJsonSchema: input.responseJsonSchema }
              : {}),
          },
        }
      : {}),
  };
}

function extractText(response: GeminiGenerateResponse) {
  return (
    response.candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("") ?? ""
  ).trim();
}

export function createGeminiProvider(): AiProvider {
  return {
    async generateText(input) {
      const config = getAiConfig();
      const apiKey = getGeminiApiKey();
      const response = await fetch(`${GEMINI_API_URL}/${config.model}:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(buildGeminiRequestBody(input)),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Gemini request failed.");
      }

      const payload = (await response.json()) as GeminiGenerateResponse;
      const text = extractText(payload);

      if (!text) {
        throw new Error("Gemini returned an empty response.");
      }

      return text;
    },
  };
}
