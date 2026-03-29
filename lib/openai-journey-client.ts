import OpenAI from "openai";
import type { z } from "zod";

import { getAppConfig } from "./config";

export type CompleteJsonOptions<T> = {
  system: string;
  user: string;
  model?: string;
  imageDataUrl?: string;
  schema: z.ZodType<T>;
};

type GenerateImageOptions = {
  prompt: string;
};

export interface JourneyLLMClient {
  completeJson<T>(options: CompleteJsonOptions<T>): Promise<T>;
  generateImage(options: GenerateImageOptions): Promise<string | null>;
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error("Model returned an empty response.");
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  throw new Error(`Could not find a JSON object in: ${trimmed}`);
}

function parseAndValidateJson<T>(rawText: string, schema: z.ZodType<T>): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(rawText));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`Model returned invalid JSON: ${message}`);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const snippet = JSON.stringify(parsed).slice(0, 400);
    throw new Error(
      `Model JSON did not match expected shape: ${result.error.message}. Snippet: ${snippet}`
    );
  }

  return result.data;
}

/**
 * OpenAI SDK against a configurable base URL (OpenAI API or any OpenAI-compatible HTTP API).
 */
export class OpenAIJourneyClient implements JourneyLLMClient {
  private client: OpenAI;
  private config = getAppConfig();

  constructor() {
    if (!this.config.apiKey) {
      throw new Error("Missing LLM_API_KEY.");
    }

    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
      timeout: this.config.requestTimeoutMs
    });
  }

  async completeJson<T>({
    system,
    user,
    model,
    imageDataUrl,
    schema
  }: CompleteJsonOptions<T>): Promise<T> {
    const completion = await this.client.chat.completions.create({
      model: model || this.config.model,
      temperature: 0.8,
      messages: [
        { role: "system", content: system },
        imageDataUrl
          ? {
              role: "user",
              content: [
                { type: "text", text: user },
                { type: "image_url", image_url: { url: imageDataUrl } }
              ]
            }
          : { role: "user", content: user }
      ]
    });

    const content = completion.choices[0]?.message?.content;
    const rawText = Array.isArray(content)
      ? content
          .map((part) => ("text" in part && part.text ? part.text : ""))
          .join("")
      : content || "";

    return parseAndValidateJson(rawText, schema);
  }

  async generateImage({ prompt }: GenerateImageOptions) {
    if (!this.config.imageGenerationEnabled) {
      return null;
    }

    const response = await this.client.images.generate({
      model: this.config.imageModel,
      prompt,
      size: "1024x1024"
    });

    const item = response.data?.[0];
    if (!item) {
      return null;
    }

    if ("url" in item && item.url) {
      return item.url;
    }

    if ("b64_json" in item && item.b64_json) {
      return `data:image/png;base64,${item.b64_json}`;
    }

    return null;
  }
}
