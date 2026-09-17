import Link from "next/link";
import { listAgentsForWorkspace } from "@/lib/agents/actions";
import "../agents.css";

export default async function AgentsPage() {
  const agents = await listAgentsForWorkspace();

  return (
    <>
      <header className="dash-header agent-header">
        <div>
          <h1>AI Agents</h1>
          <p>Configure voice, language, objective and system prompt.</p>
        </div>
        <Link href="/dashboard/agents/new" className="primary-btn">
          Create agent
        </Link>
      </header>

      {agents.length === 0 ? (
        <section className="dash-panel">
          <h2>No agents yet</h2>
          <p>Create your first agent to power test calls.</p>
          <div className="dash-panel-actions">
            <Link href="/dashboard/agents/new" className="primary-btn">
              Create your first agent
            </Link>
          </div>
        </section>
      ) : (
        <div className="agent-list">
          {agents.map((agent) => (
            <Link
              key={agent.id}
              href={`/dashboard/agents/${agent.id}`}
              className="agent-row"
            >
              <div>
                <strong>{agent.name}</strong>
                <p>
                  {agent.language}
                  {agent.objective ? ` · ${agent.objective}` : ""}
                </p>
              </div>
              <span
                className={`agent-status ${agent.active ? "agent-status-active" : "agent-status-paused"}`}
              >
                {agent.active ? "ACTIVE" : "INACTIVE"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
