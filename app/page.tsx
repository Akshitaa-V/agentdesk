import Chat from "@/components/Chat";

export default function Home() {
  return (
    <main className="shell">
      <header className="top">
        <h1>AgentDesk</h1>
        <p>Support agent for a demo note-taking app. Every tool call the agent makes shows up in the trace.</p>
      </header>
      <Chat />
    </main>
  );
}
