import { NextResponse } from "next/server";

import { JsonChatStore } from "../../../lib/chat-store";
import { JsonGameStateStore } from "../../../lib/game-state-store";
import { JsonJournalStore } from "../../../lib/journal-store";

export async function GET() {
  const store = new JsonJournalStore();
  const records = await store.listRecords();
  return NextResponse.json({ records });
}

// A reset should return the world to a blank slate: clearing only the journals
// left plot progress (flags/completed plots) behind, so once-only plots could
// never fire again. Wipe journals, game state, and live chats together.
export async function DELETE() {
  await Promise.all([
    new JsonJournalStore().clearRecords(),
    new JsonGameStateStore().reset(),
    new JsonChatStore().clearSessions()
  ]);
  return NextResponse.json({ ok: true });
}
