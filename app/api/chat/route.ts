import { NextResponse } from "next/server";
import { APIConnectionError, APIError } from "openai";
import { z } from "zod";

import { runChatTurn } from "../../../lib/chat-orchestrator";

/** Allow the director + reply calls room to finish on serverless. */
export const maxDuration = 120;

const chatSchema = z.object({
  sessionId: z.string().trim().min(1).max(80).optional(),
  catName: z.string().trim().min(1).max(30),
  zoneId: z.string().trim().min(1).max(40),
  zoneName: z.string().trim().min(1).max(60),
  npcId: z.string().trim().min(1).max(40),
  npcAlias: z.string().trim().min(1).max(40),
  npcRole: z.string().trim().min(1).max(40),
  nearbyCats: z.array(z.string().trim().min(1).max(40)).max(6).optional(),
  playerMessage: z.string().trim().min(1).max(500)
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = chatSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const result = await runChatTurn(parsed.data);
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
