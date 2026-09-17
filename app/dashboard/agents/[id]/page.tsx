import { notFound } from "next/navigation";
import { AgentForm } from "@/component/AgentForm";
import { getAgentForWorkspace } from "@/lib/agents/actions";
import { getCurrentWorkspace } from "@/lib/workspace";
import "../../agents.css";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditAgentPage({ params }: Props) {
  const { id } = await params;
  const [{ business }, agent] = await Promise.all([
    getCurrentWorkspace(),
    getAgentForWorkspace(id),
  ]);

  if (!agent) notFound();

  return (
    <>
      <header className="dash-header">
        <h1>{agent.name}</h1>
        <p>
          Update prompt and objective. Business facts live in{" "}
          <a href="/dashboard/knowledge">Knowledge</a>.
        </p>
      </header>

      <section className="dash-panel">
        <AgentForm mode="edit" agent={agent} businessName={business.name} />
      </section>
    </>
  );
}
