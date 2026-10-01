export type Role = "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export type TraceStep =
  | { type: "tool_call"; name: string; input: unknown }
  | { type: "tool_result"; name: string; output: unknown; ms: number; isError: boolean }
  | { type: "final"; text: string };

export interface AgentResult {
  reply: string;
  steps: TraceStep[];
  mode: "claude" | "offline";
  usage?: { inputTokens: number; outputTokens: number };
}
