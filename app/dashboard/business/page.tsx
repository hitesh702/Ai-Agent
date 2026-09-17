import { BusinessForm } from "@/component/BusinessForm";
import { getCurrentWorkspace } from "@/lib/workspace";
import "../../auth.css";

export default async function BusinessSettingsPage() {
  const { business } = await getCurrentWorkspace();

  return (
    <>
      <header className="dash-header">
        <h1>Business profile</h1>
        <p>This information grounds your AI agents and knowledge base.</p>
      </header>

      <section className="dash-panel">
        <BusinessForm mode="edit" business={business} />
      </section>
    </>
  );
}
