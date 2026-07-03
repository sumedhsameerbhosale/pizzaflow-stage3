"use client";

import { useState } from "react";
import type { MenuItem } from "@/lib/types";

type ChatMessage = { role: "user" | "assistant"; content: string; offline?: boolean };

type Props = {
  menu: { bases: MenuItem[]; pizzas: MenuItem[]; toppings: MenuItem[] };
};

/**
 * Non-blocking chat side-panel. This component never touches order
 * state or the order API -- it can fail entirely and the order form
 * next to it keeps working, per Stage 1's own risk note that an AI
 * feature "must not block the core ordering flow."
 */
export default function AssistantPanel({ menu }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! Ask me for menu suggestions, or I'll flag anything that looks like a likely mistake as you build the order.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          menu,
        }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
          offline: data.source === "fallback",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "The order assistant is temporarily unavailable. You can continue building the order manually -- nothing is blocked.",
          offline: true,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col rounded-lg border bg-white">
      <div className="border-b p-3">
        <h2 className="font-semibold text-gray-800">Smart Order Assistant</h2>
        <p className="text-xs text-gray-500">Optional -- advisory only</p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3" style={{ maxHeight: 320 }}>
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-md p-2 text-sm ${
              m.role === "user"
                ? "ml-6 bg-blue-50 text-blue-900"
                : m.offline
                  ? "mr-6 bg-yellow-50 text-yellow-800"
                  : "mr-6 bg-gray-50 text-gray-800"
            }`}
          >
            {m.offline && (
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-yellow-600">
                Offline mode
              </span>
            )}
            {m.content}
          </div>
        ))}
        {sending && (
          <div className="mr-6 rounded-md bg-gray-50 p-2 text-sm text-gray-400">
            Thinking...
          </div>
        )}
      </div>
      <form onSubmit={sendMessage} className="flex gap-2 border-t p-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about the menu..."
          className="flex-1 rounded-md border px-2 py-1 text-sm"
        />
        <button
          type="submit"
          disabled={sending}
          className="rounded-md bg-gray-800 px-3 py-1 text-sm text-white hover:bg-gray-900 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
