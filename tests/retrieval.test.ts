import { describe, expect, it } from "vitest";
import { cosine, embed, tokenize } from "@/lib/embeddings";
import { chunkText, VectorStore } from "@/lib/vectorStore";
import { getKnowledgeStore } from "@/lib/knowledge";

describe("embeddings", () => {
  it("drops stop words and punctuation", () => {
    expect(tokenize("How do I reset MY passwords?")).toEqual(["reset", "password"]);
  });

  it("produces unit vectors", () => {
    const v = embed("refund for annual plan");
    expect(cosine(v, v)).toBeCloseTo(1, 5);
  });

  it("scores related text higher than unrelated text", () => {
    const q = embed("refund my annual subscription");
    expect(cosine(q, embed("annual plans can be refunded within 14 days"))).toBeGreaterThan(
      cosine(q, embed("two-factor authentication with an authenticator app")),
    );
  });
});

describe("VectorStore", () => {
  const store = new VectorStore();
  store.add([
    { id: "a", title: "Refunds", text: "annual plans refunded within 14 days" },
    { id: "b", title: "Passwords", text: "reset password link expires after 30 minutes" },
    { id: "c", title: "Sync", text: "notes not syncing between devices press sync now" },
  ]);

  it("returns the best match first and respects k", () => {
    const hits = store.search("forgot password reset link", 2);
    expect(hits.length).toBeLessThanOrEqual(2);
    expect(hits[0].id).toBe("b");
    for (let i = 1; i < hits.length; i++) expect(hits[i - 1].score).toBeGreaterThanOrEqual(hits[i].score);
  });

  it("returns nothing for k <= 0 or an empty index", () => {
    expect(store.search("password", 0)).toEqual([]);
    expect(new VectorStore().search("password")).toEqual([]);
  });
});

describe("chunkText", () => {
  it("keeps short text as one chunk", () => {
    expect(chunkText("one two three", 10, 2)).toEqual(["one two three"]);
  });

  it("overlaps windows and covers every word", () => {
    const words = Array.from({ length: 25 }, (_, i) => `w${i}`);
    const chunks = chunkText(words.join(" "), 10, 3);
    expect(chunks[0].split(" ").slice(-3)).toEqual(chunks[1].split(" ").slice(0, 3));
    expect(chunks.at(-1)!.endsWith("w24")).toBe(true);
  });

  it("rejects overlap >= window", () => {
    expect(() => chunkText("a b c", 3, 3)).toThrow();
  });
});

describe("knowledge base", () => {
  it("retrieves the refund article for a refund question", () => {
    const [top] = getKnowledgeStore().search("can I get my money back on the yearly plan refund", 1);
    expect(top.title).toBe("Refunds and cancellations");
  });
});
