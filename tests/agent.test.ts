import { beforeEach, describe, expect, it } from "vitest";
import { classify, runOfflineAgent } from "@/lib/agent";
import { executeTool } from "@/lib/tools";
import { resetTickets } from "@/lib/tickets";

beforeEach(() => resetTickets());

describe("tools", () => {
  it("returns an error object instead of throwing on bad input", () => {
    expect(executeTool("search_knowledge_base", {}).error).toMatch(/query/);
    expect(executeTool("create_ticket", { title: "x", description: "y", category: "nope", priority: "low" }).error).toMatch(
      /category/,
    );
    expect(executeTool("does_not_exist", {}).error).toMatch(/Unknown tool/);
  });

  it("creates a ticket and finds it again", () => {
    const created = executeTool("create_ticket", {
      title: "Export crash",
      description: "App crashes on PDF export",
      category: "bug",
      priority: "medium",
    });
    const id = (created.ticket as { id: string }).id;
    expect(id).toBe("T-1001");
    expect((executeTool("get_ticket_status", { ticket_id: id.toLowerCase() }).ticket as { id: string }).id).toBe(id);
  });
});

describe("classify", () => {
  it("routes billing and account questions", () => {
    expect(classify("I want a refund").category).toBe("billing");
    expect(classify("can't log in to my account").category).toBe("account");
  });
  it("marks outages as high priority", () => {
    expect(classify("everything is down for all users").priority).toBe("high");
  });
});

describe("offline agent", () => {
  it("answers from the knowledge base without opening a ticket", async () => {
    const res = await runOfflineAgent([{ role: "user", content: "How do I reset my password?" }]);
    const calls = res.steps.filter((s) => s.type === "tool_call").map((s) => (s as { name: string }).name);
    expect(calls).toEqual(["search_knowledge_base"]);
    expect(res.reply).toMatch(/password/i);
  });

  it("opens a ticket for a bug report, then reports its status", async () => {
    const first = await runOfflineAgent([{ role: "user", content: "The app crashes when I export to PDF" }]);
    const id = first.reply.match(/T-\d+/)?.[0];
    expect(id).toBe("T-1001");

    const second = await runOfflineAgent([{ role: "user", content: `What's the status of ${id}?` }]);
    expect(second.reply).toMatch(/open/);
    expect(second.steps.at(-1)?.type).toBe("final");
  });
});

describe("offline agent guardrails", () => {
  it("does not open tickets for off-topic questions", async () => {
    const res = await runOfflineAgent([{ role: "user", content: "can you recommend a pizza place" }]);
    expect(res.steps.some((s) => s.type === "tool_call" && s.name === "create_ticket")).toBe(false);
    expect(res.reply).toMatch(/couldn't find/);
  });
});
