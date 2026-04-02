export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type AiTextPart = {
  text: string;
};

export type AiInlineDataPart = {
  inlineData: {
    mimeType: string;
    data: string;
  };
};

export type AiPart = AiTextPart | AiInlineDataPart;

export type AiMessage = {
  role: ChatRole;
  parts: AiPart[];
};

export type AiResponseMimeType = "text/plain" | "application/json";

export type AiGenerateTextInput = {
  messages: AiMessage[];
  systemInstruction?: string;
  responseMimeType?: AiResponseMimeType;
  responseJsonSchema?: Record<string, unknown>;
};

export type AiProvider = {
  generateText(input: AiGenerateTextInput): Promise<string>;
};

export type AiProviderName = "gemini";

export type AiConfig = {
  provider: AiProviderName;
  model: string;
  requireAuth: boolean;
};
