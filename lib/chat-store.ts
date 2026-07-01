import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getAppConfig } from "./config";
import type { ChatSession } from "./types";

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}

const MAX_SESSIONS = 30;

export interface ChatStore {
  getSession(id: string): Promise<ChatSession | null>;
  saveSession(session: ChatSession): Promise<ChatSession>;
}

export class JsonChatStore implements ChatStore {
  constructor(private readonly filePath = getAppConfig().chatSessionsPath) {}

  private async ensureFile() {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await readFile(this.filePath, "utf8");
    } catch (error) {
      if (isEnoent(error)) {
        await writeFile(this.filePath, "[]\n", "utf8");
        return;
      }
      throw error;
    }
  }

  private async listSessions(): Promise<ChatSession[]> {
    await this.ensureFile();
    const raw = await readFile(this.filePath, "utf8");
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as ChatSession[]) : [];
    } catch (error) {
      console.error(
        `[JsonChatStore] Failed to parse JSON at ${this.filePath}:`,
        error instanceof Error ? error.message : error
      );
      return [];
    }
  }

  async getSession(id: string): Promise<ChatSession | null> {
    const sessions = await this.listSessions();
    return sessions.find((session) => session.id === id) ?? null;
  }

  async saveSession(session: ChatSession): Promise<ChatSession> {
    const sessions = await this.listSessions();
    const withoutCurrent = sessions.filter((existing) => existing.id !== session.id);
    const nextSessions = [session, ...withoutCurrent].slice(0, MAX_SESSIONS);
    await writeFile(this.filePath, `${JSON.stringify(nextSessions, null, 2)}\n`, "utf8");
    return session;
  }
}
