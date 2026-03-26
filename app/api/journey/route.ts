import { NextResponse } from "next/server";
import { z } from "zod";

import { runJourney } from "../../../lib/orchestrator";

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
  imageDataUrl: z.string().trim().optional(),
  generatePostcard: z.boolean().optional().default(false)
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = journeySchema.parse(json);
    const result = await runJourney(input);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "TravelNeko ran into an unexpected error.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
