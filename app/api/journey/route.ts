import { NextResponse } from "next/server";
import { APIConnectionError, APIError } from "openai";
import { z } from "zod";

import { runJourney } from "../../../lib/orchestrator";

/** Allow long multi-agent runs on serverless (seconds). */
export const maxDuration = 300;

/** Rough cap for base64 data URLs (~1.8MB binary) to limit memory and parse time. */
const MAX_IMAGE_DATA_URL_CHARS = 2_500_000;

const journeySchema = z.object({
  catName: z.string().trim().min(1).max(30),
  destination: z.string().trim().min(2).max(60),
  mood: z.string().trim().min(2).max(30),
  travelStyle: z.string().trim().min(2).max(40),
  userAction: z.string().trim().min(2).max(120),
  currentArea: z.string().trim().min(2).max(60).optional(),
  focusCatName: z.string().trim().min(1).max(40).optional(),
  focusCatRole: z.string().trim().min(1).max(40).optional(),
  nearbyCats: z.array(z.string().trim().min(1).max(40)).max(6).optional(),
  encounterMode: z.enum(["manual_talk", "auto_explore"]).optional(),
  imageDataUrl: z
    .string()
    .trim()
    .max(MAX_IMAGE_DATA_URL_CHARS, "Image payload is too large.")
    .optional(),
  generatePostcard: z.boolean().optional().default(false)
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = journeySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const result = await runJourney(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof APIConnectionError) {
      return NextResponse.json(
        { error: "Could not reach the model provider." },
        { status: 503 }
      );
    }

    if (error instanceof APIError) {
      const status = error.status;
      if (status === 429) {
        return NextResponse.json({ error: error.message }, { status: 429 });
      }
      if (status !== undefined && status >= 500) {
        return NextResponse.json(
          { error: "Model provider returned an error." },
          { status: 502 }
        );
      }
      return NextResponse.json(
        { error: "Model provider rejected the request." },
        { status: 502 }
      );
    }

    const message =
      error instanceof Error ? error.message : "TravelNeko ran into an unexpected error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
