"use client";

import { KeyboardEvent, useEffect, useRef, useState } from "react";

import type { ChatMessage, ChatTurnResponse } from "../lib/types";

type ChatWindowProps = {
  catName: string;
  zoneId: string;
  zoneName: string;
  npcId: string;
  npcAlias: string;
  npcRole: string;
  nearbyCats?: string[];
  /** Reports the current transcript upward so the parent can archive it. */
  onMessagesChange?: (messages: ChatMessage[]) => void;
};

/**
 * A self-contained multi-turn chat with one NPC. Each sent message hits
 * /api/chat, where the plot director may trigger a story beat mid-conversation.
 * Parent should mount this with `key={npcId}` so switching NPCs starts fresh.
 */
export function ChatWindow({
  catName,
  zoneId,
  zoneName,
  npcId,
  npcAlias,
  npcRole,
  nearbyCats,
  onMessagesChange
}: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) {
      thread.scrollTop = thread.scrollHeight;
    }
  }, [messages, isSending]);

  useEffect(() => {
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  async function send() {
    const text = draft.trim();
    if (!text || isSending) {
      return;
    }

    const optimistic: ChatMessage = {
      role: "player",
      speaker: catName,
      text,
      at: new Date().toISOString()
    };
    setMessages((current) => [...current, optimistic]);
    setDraft("");
    setError("");
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId ?? undefined,
          catName,
          zoneId,
          zoneName,
          npcId,
          npcAlias,
          npcRole,
          nearbyCats,
          playerMessage: text
        })
      });

      const json = (await response.json()) as ChatTurnResponse | { error: string };
      if (!response.ok || "error" in json) {
        throw new Error("error" in json ? json.error : "聊天失败，请再试一次。");
      }

      setSessionId(json.session.id);
      // Trust the server's transcript so optimistic + real stay in sync.
      setMessages(json.session.messages);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "聊天遇到问题，请再试一次。");
      // Roll back the optimistic message so the user can retry.
      setMessages((current) => current.filter((message) => message !== optimistic));
      setDraft(text);
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  return (
    <div className="chat-window">
      <div className="chat-window-head">
        <div>
          <p className="eyebrow">Live Chat</p>
          <h3>
            和 {npcAlias} 聊天 <span className="chat-role">· {npcRole}</span>
          </h3>
        </div>
        <span className="chat-hint">Enter 发送 · Shift+Enter 换行</span>
      </div>

      <div className="chat-thread" ref={threadRef}>
        {messages.length === 0 ? (
          <p className="chat-empty">先打个招呼吧，聊着聊着可能会触发一段剧情。</p>
        ) : (
          messages.map((message, index) => (
            <div
              className={`chat-bubble ${message.role === "player" ? "is-player" : "is-npc"}`}
              key={`${message.at}-${index}`}
            >
              <span className="chat-speaker">{message.speaker}</span>
              <p>{message.text}</p>
              {message.triggeredPlot ? (
                <span className="chat-plot-badge">✦ 触发剧情：{message.triggeredPlot.title}</span>
              ) : null}
            </div>
          ))
        )}
        {isSending ? <p className="chat-typing">{npcAlias} 正在回复…</p> : null}
      </div>

      {error ? <p className="chat-error">{error}</p> : null}

      <div className="chat-input-row">
        <textarea
          className="chat-input"
          disabled={isSending}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`和 ${npcAlias} 说点什么…`}
          rows={2}
          value={draft}
        />
        <button
          className="chat-send"
          disabled={isSending || !draft.trim()}
          onClick={() => void send()}
          type="button"
        >
          发送
        </button>
      </div>
    </div>
  );
}
