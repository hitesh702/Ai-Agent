import { DashboardShell } from "@/component/DashboardShell";
import { getCurrentWorkspace } from "@/lib/workspace";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, business } = await getCurrentWorkspace();

  return (
    <DashboardShell userName={user.name} businessName={business.name}>
      {children}
    </DashboardShell>
  );
}
