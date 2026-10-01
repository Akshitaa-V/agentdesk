import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";

const MAX_MESSAGES = 30;
const MAX_CHARS = 4000;

function parseMessages(body: unknown): ChatMessage[] | string {
  const messages = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(messages) || messages.length === 0) return "messages must be a non-empty array";
  if (messages.length > MAX_MESSAGES) return `at most ${MAX_MESSAGES} messages per request`;
  for (const m of messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") {
      return "each message needs role 'user' | 'assistant' and string content";
    }
    if (m.content.length > MAX_CHARS) return `message content is limited to ${MAX_CHARS} characters`;
  }
  if (messages[messages.length - 1].role !== "user") return "the last message must come from the user";
  return messages as ChatMessage[];
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON" }, { status: 400 });
  }

  const parsed = parseMessages(body);
  if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });

  try {
    const started = Date.now();
    const result = await runAgent(parsed);
    return NextResponse.json({ ...result, latencyMs: Date.now() - started });
  } catch (err) {
    console.error("agent error", err);
    return NextResponse.json({ error: "The agent failed to respond. Please try again." }, { status: 502 });
  }
}
