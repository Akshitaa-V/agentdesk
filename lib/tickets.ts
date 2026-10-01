export const CATEGORIES = ["billing", "account", "bug", "other"] as const;
export const PRIORITIES = ["low", "medium", "high"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Priority = (typeof PRIORITIES)[number];

export interface Ticket {
  id: string;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
}

/**
 * In-memory ticket store. Kept on globalThis so it survives Next.js hot reloads in dev.
 * In production this would be a Postgres table behind the same two functions.
 */
const g = globalThis as unknown as { __tickets?: Map<string, Ticket>; __ticketSeq?: number };
g.__tickets ??= new Map();
g.__ticketSeq ??= 1000;

export function createTicket(input: Omit<Ticket, "id" | "status" | "createdAt">): Ticket {
  g.__ticketSeq! += 1;
  const ticket: Ticket = {
    ...input,
    id: `T-${g.__ticketSeq}`,
    status: "open",
    createdAt: new Date().toISOString(),
  };
  g.__tickets!.set(ticket.id, ticket);
  return ticket;
}

export function getTicket(id: string): Ticket | undefined {
  return g.__tickets!.get(id.trim().toUpperCase());
}

export function resetTickets(): void {
  g.__tickets!.clear();
  g.__ticketSeq = 1000;
}
