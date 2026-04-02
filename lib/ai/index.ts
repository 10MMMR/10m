import { getAiConfig } from "./config";
import { createGeminiProvider } from "./providers/gemini";
import type { AiProvider } from "./types";

export function getAiProvider(): AiProvider {
  const config = getAiConfig();

  switch (config.provider) {
    case "gemini":
      return createGeminiProvider();
    default:
      throw new Error(`Unsupported AI provider "${config.provider}".`);
  }
}
