import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentDesk",
  description: "AI support agent with function calling, RAG and a live trace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
