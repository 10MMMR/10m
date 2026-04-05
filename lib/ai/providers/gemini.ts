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

function logGeminiError(context: string, details: Record<string, unknown>) {
  console.error(`Gemini error: ${context}`, details);
}

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
      const requestBody = buildGeminiRequestBody(input);
      const response = await fetch(`${GEMINI_API_URL}/${config.model}:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logGeminiError("request failed", {
          model: config.model,
          responseBodyLength: errorText.length,
          status: response.status,
          statusText: response.statusText,
        });
        throw new Error(errorText || "Gemini request failed.");
      }

      let payload: GeminiGenerateResponse;

      try {
        payload = (await response.json()) as GeminiGenerateResponse;
      } catch (error) {
        logGeminiError("invalid JSON response", {
          error: error instanceof Error ? error.message : String(error),
          model: config.model,
        });
        throw new Error("Gemini returned invalid JSON.");
      }

      const text = extractText(payload);

      if (!text) {
        logGeminiError("empty response", {
          candidateCount: payload.candidates?.length ?? 0,
          model: config.model,
        });
        throw new Error("Gemini returned an empty response.");
      }

      return text;
    },
  };
}
