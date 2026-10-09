import { GoogleGenAI } from '@google/genai';

/**
 * Thin wrapper over the official `@google/genai` SDK (ESM). It isolates the SDK
 * behind a single function so the provider stays testable without network access,
 * mirroring how the other image providers keep a seam for tests.
 *
 * The API key is passed to the SDK (sent as the `x-goog-api-key` header) and is
 * never placed in a URL, log line, or error message.
 */

export interface GeminiImageRequest {
  model: string;
  prompt: string;
  aspectRatio: string;
}

export interface GeminiPart {
  text?: string;
  inlineData?: { data?: string; mimeType?: string };
}

export interface GeminiImageResult {
  parts: GeminiPart[];
  usage: unknown;
}

export type GeminiGenerate = (request: GeminiImageRequest) => Promise<GeminiImageResult>;

export function createGeminiGenerate(apiKey: string): GeminiGenerate {
  const ai = new GoogleGenAI({ apiKey });
  return async ({ model, prompt, aspectRatio }) => {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        // Gemini image models must allow both modalities; the image arrives as
        // inlineData on the first candidate's parts.
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio },
      },
    });
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    return {
      parts: parts.map((part) => ({
        text: part.text,
        inlineData: part.inlineData
          ? { data: part.inlineData.data, mimeType: part.inlineData.mimeType }
          : undefined,
      })),
      usage: response.usageMetadata ?? null,
    };
  };
}
