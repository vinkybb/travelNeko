import { TravelNekoApp } from "../components/travel-neko-app";
import { getPublicConfig } from "../lib/config";
import { JsonJournalStore } from "../lib/journal-store";

export default async function HomePage() {
  const store = new JsonJournalStore();
  const records = await store.listRecords();
  const config = getPublicConfig();

  return <TravelNekoApp initialRecords={records} config={config} />;
}
