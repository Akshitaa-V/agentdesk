import type Anthropic from "@anthropic-ai/sdk";
import { getKnowledgeStore } from "./knowledge";
import { CATEGORIES, PRIORITIES, createTicket, getTicket, type Category, type Priority } from "./tickets";

/** JSON-schema tool definitions in the format Claude's function calling expects. */
export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "search_knowledge_base",
    description:
      "Semantic search over the Nimbus help-centre articles. Use it before answering any product, billing or account question. Returns the best matching passages with a similarity score.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to look for, in plain words." },
        top_k: { type: "integer", minimum: 1, maximum: 5, description: "How many passages to return (default 3)." },
      },
      required: ["query"],
    },
  },
  {
    name: "create_ticket",
    description:
      "Open a support ticket when the knowledge base does not solve the problem, the user reports a bug, or the user explicitly asks for a ticket.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short summary, max 80 characters." },
        description: { type: "string", description: "What happened, including any details the user gave." },
        category: { type: "string", enum: [...CATEGORIES] },
        priority: {
          type: "string",
          enum: [...PRIORITIES],
          description: "high = service down or data at risk, medium = feature broken, low = question or wish.",
        },
      },
      required: ["title", "description", "category", "priority"],
    },
  },
  {
    name: "get_ticket_status",
    description: "Look up an existing ticket by its ID, for example T-1001.",
    input_schema: {
      type: "object",
      properties: { ticket_id: { type: "string" } },
      required: ["ticket_id"],
    },
  },
];

export type ToolOutput = Record<string, unknown> & { error?: string };

const isString = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/**
 * Execute a tool by name. Invalid input never throws: it returns { error } so the
 * model sees what went wrong and can correct its next call instead of failing silently.
 */
export function executeTool(name: string, rawInput: unknown): ToolOutput {
  const input = (rawInput ?? {}) as Record<string, unknown>;

  switch (name) {
    case "search_knowledge_base": {
      if (!isString(input.query)) return { error: "query must be a non-empty string" };
      const topK = Number.isInteger(input.top_k) ? Math.min(Math.max(input.top_k as number, 1), 5) : 3;
      const hits = getKnowledgeStore().search(input.query, topK);
      return { results: hits.map(({ title, text, score }) => ({ title, text, score })) };
    }

    case "create_ticket": {
      const { title, description, category, priority } = input;
      if (!isString(title) || !isString(description)) return { error: "title and description are required strings" };
      if (!CATEGORIES.includes(category as Category)) return { error: `category must be one of ${CATEGORIES.join(", ")}` };
      if (!PRIORITIES.includes(priority as Priority)) return { error: `priority must be one of ${PRIORITIES.join(", ")}` };
      const ticket = createTicket({
        title: title.slice(0, 80),
        description,
        category: category as Category,
        priority: priority as Priority,
      });
      return { ticket };
    }

    case "get_ticket_status": {
      if (!isString(input.ticket_id)) return { error: "ticket_id must be a string like T-1001" };
      const ticket = getTicket(input.ticket_id);
      return ticket ? { ticket } : { error: `No ticket found with ID ${input.ticket_id}` };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
