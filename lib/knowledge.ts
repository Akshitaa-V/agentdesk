import { chunkText, VectorStore, type Doc } from "./vectorStore";

/**
 * Help-centre articles for "Nimbus", a fictional note-taking SaaS used as the demo domain.
 * Replace with your own docs: anything that ends up as { id, title, text } can be indexed.
 */
export const ARTICLES: Doc[] = [
  {
    id: "billing-refunds",
    title: "Refunds and cancellations",
    text: "You can cancel a Nimbus subscription at any time from Settings > Billing. Monthly plans stay active until the end of the paid period. Annual plans can be refunded in full within 14 days of purchase; after 14 days we refund the unused months on request. Refunds go back to the original payment method within 5 to 10 business days.",
  },
  {
    id: "billing-invoices",
    title: "Invoices and VAT",
    text: "Invoices are emailed after every payment and can be downloaded as PDF from Settings > Billing > Invoices. Business customers in the EU can add a VAT ID in the billing profile; the reverse-charge mechanism is then applied to future invoices, not past ones.",
  },
  {
    id: "account-password",
    title: "Resetting your password",
    text: "To reset your password, click 'Forgot password' on the login page and follow the link we email you. The link expires after 30 minutes. If no email arrives, check the spam folder and confirm that you are using the address your account was created with. Accounts using Google or Apple sign-in do not have a separate Nimbus password.",
  },
  {
    id: "account-2fa",
    title: "Two-factor authentication",
    text: "Two-factor authentication can be turned on in Settings > Security using any authenticator app. Save the recovery codes shown during setup. If you lose both your phone and your recovery codes, support has to verify your identity before 2FA can be removed, which takes up to two business days.",
  },
  {
    id: "sync-issues",
    title: "Notes not syncing between devices",
    text: "If notes do not sync, first check that every device is signed in to the same account and is online. Open Settings > Sync and press 'Sync now'. Sync conflicts create a copy of the note with the word 'conflict' in the title so nothing is lost. If sync still fails after updating the app to the latest version, open a support ticket and include the device type and app version.",
  },
  {
    id: "export-data",
    title: "Exporting your notes",
    text: "You can export all notes as Markdown or PDF from Settings > Data > Export. Large workspaces are prepared in the background and a download link is emailed when ready; the link stays valid for 7 days. Attachments are included in the Markdown export as a separate folder.",
  },
  {
    id: "plans-limits",
    title: "Plans and storage limits",
    text: "The Free plan includes 2 devices and 1 GB of storage. Pro includes unlimited devices, 50 GB of storage and version history for 90 days. Team adds shared workspaces, admin controls and SSO. When you hit the storage limit, existing notes stay readable but new attachments cannot be uploaded until you free space or upgrade.",
  },
  {
    id: "outage-status",
    title: "Service status and outages",
    text: "Current service status is published on the Nimbus status page. During an outage, notes created offline are stored on the device and synced automatically once the service is back. If you believe you are affected by an outage that is not listed, open a high-priority ticket.",
  },
];

let store: VectorStore | null = null;

/** Lazily build the index once per server process. */
export function getKnowledgeStore(): VectorStore {
  if (!store) {
    store = new VectorStore();
    for (const article of ARTICLES) {
      chunkText(article.text).forEach((text, i) =>
        store!.add([{ id: `${article.id}#${i}`, title: article.title, text }]),
      );
    }
  }
  return store;
}
