import { KnowledgeForm } from "@/component/KnowledgeForm";
import { knowledgeItemsToFormValues } from "@/lib/knowledge/categories";
import { listKnowledgeForWorkspace } from "@/lib/knowledge/actions";
import "../../auth.css";
import "../calls.css";

export default async function KnowledgePage() {
  const { business, items } = await listKnowledgeForWorkspace();
  const values = knowledgeItemsToFormValues(items);
  const filled = Object.values(values).filter((v) => v.trim()).length;

  return (
    <>
      <header className="dash-header">
        <h1>Business knowledge</h1>
        <p>
          Enter only information the AI is allowed to say on calls. Missing
          topics are never invented.
        </p>
      </header>

      <div className="dash-grid" style={{ marginBottom: 16 }}>
        <div className="dash-stat">
          <span>Sections filled</span>
          <strong>
            {filled}/{Object.keys(values).length}
          </strong>
        </div>
        <div className="dash-stat">
          <span>Active knowledge rows</span>
          <strong>{items.filter((i) => i.active && i.content.trim()).length}</strong>
        </div>
        <div className="dash-stat">
          <span>Used by</span>
          <strong style={{ fontSize: 18 }}>AI voice calls</strong>
        </div>
      </div>

      <section className="dash-panel">
        <KnowledgeForm businessName={business.name} values={values} />
      </section>
    </>
  );
}
