import OpenAI from "openai";

import { getAppConfig } from "./config";

type CompleteJsonOptions = {
  system: string;
  user: string;
  model?: string;
  imageDataUrl?: string;
};

type GenerateImageOptions = {
  prompt: string;
};

export interface JourneyLLMClient {
  completeJson<T>(options: CompleteJsonOptions): Promise<T>;
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

export class StepJourneyClient implements JourneyLLMClient {
  private client: OpenAI;
  private config = getAppConfig();

  constructor() {
    if (!this.config.apiKey) {
      throw new Error(
        "Missing STEP_API_KEY or OPENAI_API_KEY. Add one to run TravelNeko."
      );
    }

    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL
    });
  }

  async completeJson<T>({
    system,
    user,
    model,
    imageDataUrl
  }: CompleteJsonOptions): Promise<T> {
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

    return JSON.parse(extractJsonObject(rawText)) as T;
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
