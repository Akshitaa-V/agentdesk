import { describe, expect, it } from "vitest";
import { getKnowledgeStore } from "@/lib/knowledge";

/**
 * Labelled retrieval eval: each query is phrased differently from the article text on purpose.
 * Reports hit@1 and hit@3 (did the right article appear first / in the top 3?).
 */
const LABELLED: [query: string, expectedTitle: string][] = [
  ["How do I get a refund on my annual plan?", "Refunds and cancellations"],
  ["cancel my subscription", "Refunds and cancellations"],
  ["money back after 10 days", "Refunds and cancellations"],
  ["where can I download my invoices", "Invoices and VAT"],
  ["add my company VAT number", "Invoices and VAT"],
  ["I forgot my password", "Resetting your password"],
  ["reset link never arrived in my email", "Resetting your password"],
  ["turn on two factor authentication", "Two-factor authentication"],
  ["lost my phone and recovery codes", "Two-factor authentication"],
  ["notes not syncing between laptop and phone", "Notes not syncing between devices"],
  ["sync conflict copy of a note", "Notes not syncing between devices"],
  ["export everything as markdown", "Exporting your notes"],
  ["download link for my export expired", "Exporting your notes"],
  ["how much storage does the free plan have", "Plans and storage limits"],
  ["what does Pro include", "Plans and storage limits"],
  ["is the service down right now", "Service status and outages"],
  ["notes created offline during an outage", "Service status and outages"],
  ["does the team plan support SSO", "Plans and storage limits"],
  ["refund goes back to which payment method", "Refunds and cancellations"],
  ["password for google sign in account", "Resetting your password"],
];

describe("retrieval eval", () => {
  it("meets the hit@1 / hit@3 bar", () => {
    const store = getKnowledgeStore();
    let hit1 = 0;
    let hit3 = 0;
    const misses: string[] = [];

    for (const [query, expected] of LABELLED) {
      const titles = store.search(query, 3, 0).map((h) => h.title);
      if (titles[0] === expected) hit1++;
      if (titles.includes(expected)) hit3++;
      else misses.push(`${query} -> ${titles.join(", ")}`);
    }

    const n = LABELLED.length;
    console.log(`retrieval eval: hit@1 ${hit1}/${n} (${Math.round((100 * hit1) / n)}%), hit@3 ${hit3}/${n} (${Math.round((100 * hit3) / n)}%)`);
    if (misses.length) console.log("misses:\n" + misses.join("\n"));

    expect(hit1 / n).toBeGreaterThanOrEqual(0.8);
    expect(hit3 / n).toBeGreaterThanOrEqual(0.9);
  });
});
