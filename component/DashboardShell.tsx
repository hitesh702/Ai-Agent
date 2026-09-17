import type { ReactNode } from "react";
import Link from "next/link";
import { logoutAction } from "@/lib/auth/actions";
import "./DashboardShell.css";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/leads", label: "Leads" },
  { href: "/dashboard/calls", label: "Calls" },
  { href: "/dashboard/agents", label: "Agents" },
  { href: "/dashboard/knowledge", label: "Knowledge" },
  { href: "/dashboard/campaigns", label: "Campaigns" },
  { href: "/dashboard/appointments", label: "Appointments" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/settings", label: "Settings" },
  { href: "/dashboard/billing", label: "Billing" },
];

type Props = {
  userName: string;
  businessName: string;
  children: ReactNode;
};

export function DashboardShell({ userName, businessName, children }: Props) {
  return (
    <div className="dash">
      <aside className="dash-sidebar">
        <Link href="/dashboard" className="dash-brand">
          <span className="dash-brand-mark">C</span>
          <span>CallAI</span>
        </Link>

        <p className="dash-org">{businessName}</p>

        <nav className="dash-nav">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="dash-nav-link">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="dash-footer">
          <div className="dash-user">
            <strong>{userName}</strong>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="dash-logout">
              Log out
            </button>
          </form>
        </div>
      </aside>

      <main className="dash-main">{children}</main>
    </div>
  );
}
