import Anthropic from "@anthropic-ai/sdk";
import { TOOL_DEFINITIONS, executeTool, type ToolOutput } from "./tools";
import type { AgentResult, ChatMessage, TraceStep } from "./types";

export const MAX_STEPS = 6;

export const SYSTEM_PROMPT = `You are the support agent for Nimbus, a note-taking app.
Rules:
- Before answering a product, billing or account question, call search_knowledge_base and base your answer only on what it returns.
- If the passages do not answer the question, or the user reports a bug or outage, call create_ticket and give the user the ticket ID.
- If a tool returns an error, read it and fix your next call. Never pretend a tool succeeded.
- Keep answers short, friendly and concrete. Answer in the user's language.`;

/** Run one agent turn. Uses Claude when ANTHROPIC_API_KEY is set, otherwise a deterministic offline planner. */
export async function runAgent(messages: ChatMessage[]): Promise<AgentResult> {
  return process.env.ANTHROPIC_API_KEY ? runClaudeAgent(messages) : runOfflineAgent(messages);
}

function timedTool(name: string, input: unknown, steps: TraceStep[]): ToolOutput {
  steps.push({ type: "tool_call", name, input });
  const t0 = performance.now();
  const output = executeTool(name, input);
  steps.push({ type: "tool_result", name, output, ms: Math.round(performance.now() - t0), isError: "error" in output });
  return output;
}

/* ------------------------------------------------------------------ */
/* Claude: the function-calling loop                                   */
/* ------------------------------------------------------------------ */

async function runClaudeAgent(messages: ChatMessage[]): Promise<AgentResult> {
  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";

  const convo: Anthropic.MessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));
  const steps: TraceStep[] = [];
  const usage = { inputTokens: 0, outputTokens: 0 };

  for (let i = 0; i < MAX_STEPS; i++) {
    const res = await client.messages.create({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOL_DEFINITIONS,
      messages: convo,
    });
    usage.inputTokens += res.usage.input_tokens;
    usage.outputTokens += res.usage.output_tokens;
    convo.push({ role: "assistant", content: res.content });

    const toolUses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || toolUses.length === 0) {
      const reply = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      steps.push({ type: "final", text: reply });
      return { reply, steps, mode: "claude", usage };
    }

    const results: Anthropic.ToolResultBlockParam[] = toolUses.map((tu) => {
      const output = timedTool(tu.name, tu.input, steps);
      return { type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(output), is_error: "error" in output };
    });
    convo.push({ role: "user", content: results });
  }

  const reply = "I could not finish this request within the step limit. I have logged it; please try rephrasing.";
  steps.push({ type: "final", text: reply });
  return { reply, steps, mode: "claude", usage };
}

/* ------------------------------------------------------------------ */
/* Offline: same tools, rule-based planning (no API key needed)        */
/* ------------------------------------------------------------------ */

const TICKET_ID = /\bT-\d{3,}\b/i;
const WANTS_TICKET = /\b(open|create|file|raise)\b.*\bticket\b|\bticket\b.*\b(please|pls)\b/i;
const PROBLEM = /\b(bug|broken|crash|crashes|error|not working|doesn'?t work|fails?|down|outage|lost)\b/i;
const MIN_CONFIDENT_SCORE = 0.2;

export function classify(text: string): { category: "billing" | "account" | "bug" | "other"; priority: "low" | "medium" | "high" } {
  const t = text.toLowerCase();
  const category = /refund|invoice|payment|charge|billing|vat|subscription/.test(t)
    ? "billing"
    : /password|login|log in|2fa|two-factor|account|sign in/.test(t)
      ? "account"
      : PROBLEM.test(t) || /sync/.test(t)
        ? "bug"
        : "other";
  const priority = /urgent|asap|down|outage|all users|data loss|lost/.test(t)
    ? "high"
    : PROBLEM.test(t)
      ? "medium"
      : "low";
  return { category, priority };
}

export async function runOfflineAgent(messages: ChatMessage[]): Promise<AgentResult> {
  const steps: TraceStep[] = [];
  const last = [...messages].reverse().find((m) => m.role === "user")?.content.trim() ?? "";
  let reply: string;

  const idMatch = last.match(TICKET_ID);
  if (idMatch) {
    const out = timedTool("get_ticket_status", { ticket_id: idMatch[0] }, steps);
    const t = out.ticket as { id: string; status: string; title: string; priority: string } | undefined;
    reply = t
      ? `Ticket ${t.id} ("${t.title}") is ${t.status.replace("_", " ")} with ${t.priority} priority.`
      : `I couldn't find ticket ${idMatch[0]}. Please double-check the ID.`;
  } else {
    const search = timedTool("search_knowledge_base", { query: last, top_k: 3 }, steps);
    const hits = (search.results as { title: string; text: string; score: number }[]) ?? [];
    const best = hits[0];

    const confident = best !== undefined && best.score >= MIN_CONFIDENT_SCORE;
    if (!confident && !WANTS_TICKET.test(last) && !PROBLEM.test(last)) {
      reply =
        "I couldn't find anything about that in the Nimbus help centre. If it's a problem with the app, describe what happened and I'll open a ticket for you.";
    } else if (WANTS_TICKET.test(last) || PROBLEM.test(last)) {
      const { category, priority } = classify(last);
      const out = timedTool(
        "create_ticket",
        { title: last.replace(/^(please\s+)?(open|create|file|raise)\s+a\s+ticket\s*[:,-]?\s*/i, "").slice(0, 80) || last.slice(0, 80), description: last, category, priority },
        steps,
      );
      const t = out.ticket as { id: string } | undefined;
      const hint = confident ? `\n\nWhile you wait, this may help (${best.title}): ${best.text}` : "";
      reply = t
        ? `I've opened ticket ${t.id} (${category}, ${priority} priority). Our team will follow up.${hint}`
        : "I tried to open a ticket but something went wrong. Please try again.";
    } else {
      reply = `From our help centre, "${best.title}": ${best.text}`;
    }
  }

  steps.push({ type: "final", text: reply });
  return { reply, steps, mode: "offline" };
}
