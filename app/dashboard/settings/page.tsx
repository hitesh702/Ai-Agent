import Link from "next/link";
import { BusinessForm } from "@/component/BusinessForm";
import { getCurrentWorkspace } from "@/lib/workspace";
import "../../auth.css";
import "../calls.css";

export default async function SettingsPage() {
  const { user, business } = await getCurrentWorkspace();

  return (
    <>
      <header className="dash-header">
        <h1>Settings</h1>
        <p>Account and business profile for {business.name}.</p>
      </header>

      <section className="dash-panel">
        <h2>Account</h2>
        <p>
          Name: {user.name}
          <br />
          Email: {user.email}
        </p>
      </section>

      <section className="dash-panel" style={{ marginTop: 16 }}>
        <h2>Business profile</h2>
        <BusinessForm mode="edit" business={business} />
      </section>

      <section className="dash-panel" style={{ marginTop: 16 }}>
        <h2>Related</h2>
        <div className="dash-panel-actions">
          <Link href="/dashboard/knowledge" className="primary-btn">
            Business knowledge
          </Link>
          <Link href="/dashboard/billing" className="primary-btn">
            Billing
          </Link>
        </div>
      </section>
    </>
  );
}
