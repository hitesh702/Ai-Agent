type Props = {
  title?: string;
  subtitle?: string;
};

export function DashboardHeader({
  title = "Dashboard",
  subtitle = "Overview of your leads and calling activity",
}: Props) {
  return (
    <header className="saas-dash-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  );
}
