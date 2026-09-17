import { AgentForm } from "@/component/AgentForm";
import { getCurrentWorkspace } from "@/lib/workspace";
import "../../agents.css";

export default async function NewAgentPage() {
  const { business } = await getCurrentWorkspace();

  return (
    <>
      <header className="dash-header">
        <h1>Create AI agent</h1>
        <p>
          Define how this agent should speak for <strong>{business.name}</strong>.
          Add courses and fees under Knowledge.
        </p>
      </header>

      <section className="dash-panel">
        <AgentForm mode="create" businessName={business.name} />
      </section>
    </>
  );
}
