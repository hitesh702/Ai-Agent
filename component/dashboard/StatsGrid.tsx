import { StatsCard } from "./StatsCard";
import type { DashboardStat } from "./types";

type Props = {
  stats: DashboardStat[];
};

export function StatsGrid({ stats }: Props) {
  if (stats.length === 0) {
    return (
      <div className="saas-empty" role="status">
        No metrics available yet.
      </div>
    );
  }

  return (
    <section className="saas-stats-grid" aria-label="Key performance metrics">
      {stats.map((stat) => (
        <StatsCard key={stat.id} stat={stat} />
      ))}
    </section>
  );
}
