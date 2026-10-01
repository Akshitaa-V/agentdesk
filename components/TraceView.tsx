import type { AgentResult } from "@/lib/types";

export default function TraceView({ result }: { result: (AgentResult & { latencyMs: number }) | null }) {
  return (
    <aside className="panel trace" aria-label="Agent trace">
      <div className="trace-head">
        <h2>Agent trace</h2>
        {result && (
          <span className={`badge ${result.mode}`}>{result.mode === "claude" ? "Claude" : "Offline demo"}</span>
        )}
      </div>

      {!result && <p className="muted">Send a message to see each tool call, its input, its output and its timing.</p>}

      {result && (
        <>
          <p className="muted small">
            {result.latencyMs} ms total
            {result.usage && ` · ${result.usage.inputTokens} in / ${result.usage.outputTokens} out tokens`}
          </p>
          <ol className="steps">
            {result.steps.map((s, i) => (
              <li key={i} className={`step ${s.type} ${s.type === "tool_result" && s.isError ? "is-error" : ""}`}>
                {s.type === "tool_call" && (
                  <>
                    <strong>call</strong> <code>{s.name}</code>
                    <pre>{JSON.stringify(s.input, null, 2)}</pre>
                  </>
                )}
                {s.type === "tool_result" && (
                  <>
                    <strong>{s.isError ? "error" : "result"}</strong> <code>{s.name}</code>{" "}
                    <span className="muted small">{s.ms} ms</span>
                    <pre>{JSON.stringify(s.output, null, 2)}</pre>
                  </>
                )}
                {s.type === "final" && (
                  <>
                    <strong>final answer</strong>
                  </>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </aside>
  );
}
