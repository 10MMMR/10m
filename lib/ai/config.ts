import type { AiConfig, AiProviderName } from "./types";

function parseProviderName(value: string | undefined): AiProviderName {
  if (!value || value === "gemini") {
    return "gemini";
  }

  throw new Error(`Unsupported AI provider "${value}".`);
}

function parseRequireAuth(value: string | undefined) {
  if (!value) {
    return true;
  }

  return value.toLowerCase() !== "false";
}

export function getAiConfig(): AiConfig {
  const model = process.env.AI_MODEL?.trim();

  if (!model) {
    throw new Error("AI_MODEL is not configured.");
  }

  return {
    provider: parseProviderName(process.env.AI_PROVIDER?.trim().toLowerCase()),
    model,
    requireAuth: parseRequireAuth(process.env.AI_REQUIRE_AUTH?.trim()),
  };
}
