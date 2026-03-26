import { NextResponse } from "next/server";

import { JsonJournalStore } from "../../../lib/journal-store";

export async function GET() {
  const store = new JsonJournalStore();
  const records = await store.listRecords();
  return NextResponse.json({ records });
}
