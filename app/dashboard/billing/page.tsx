import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentWorkspace } from "@/lib/workspace";
import "../calls.css";

export default async function BillingPage() {
  const { business } = await getCurrentWorkspace();

  const subscription = await prisma.subscription.findFirst({
    where: { businessId: business.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <header className="dash-header">
        <h1>Billing</h1>
        <p>Plan and subscription status for {business.name}.</p>
      </header>

      <section className="dash-panel">
        <h2>Current plan</h2>
        {subscription ? (
          <p>
            Plan: <strong>{subscription.plan}</strong>
            <br />
            Status: {subscription.status}
            <br />
            Period:{" "}
            {subscription.currentPeriodStart
              ? subscription.currentPeriodStart.toLocaleDateString()
              : "—"}{" "}
            →{" "}
            {subscription.currentPeriodEnd
              ? subscription.currentPeriodEnd.toLocaleDateString()
              : "—"}
          </p>
        ) : (
          <p>
            No paid subscription yet. You are on the free MVP workspace. Stripe /
            Razorpay checkout will plug in here later.
          </p>
        )}
      </section>

      <section className="dash-panel" style={{ marginTop: 16 }}>
        <h2>Plans (preview)</h2>
        <ul className="simple-list">
          <li>
            <strong>Starter</strong>
            <span>Limited test calls · 1 agent</span>
          </li>
          <li>
            <strong>Growth</strong>
            <span>More minutes · multiple agents · campaigns</span>
          </li>
          <li>
            <strong>Business</strong>
            <span>Higher volume · priority support</span>
          </li>
        </ul>
        <div className="dash-panel-actions" style={{ marginTop: 16 }}>
          <Link href="/dashboard/settings" className="primary-btn">
            Back to settings
          </Link>
        </div>
      </section>
    </>
  );
}
