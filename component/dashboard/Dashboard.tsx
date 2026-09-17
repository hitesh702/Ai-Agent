"use client";

import { useCallback, useState } from "react";
import { CallDetailsDrawer } from "./CallDetailsDrawer";
import { DashboardHeader } from "./DashboardHeader";
import { RecentCalls } from "./RecentCalls";
import { StatsGrid } from "./StatsGrid";
import type { DashboardData, RecentCallRow } from "./types";
import "./dashboard.css";

type Props = {
  data: DashboardData;
};

export function Dashboard({ data }: Props) {
  const [selected, setSelected] = useState<RecentCallRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleView = useCallback((call: RecentCallRow) => {
    setSelected(call);
    setDrawerOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  return (
    <div className="saas-dashboard">
      <DashboardHeader />
      <StatsGrid stats={data.stats} />
      <RecentCalls calls={data.recentCalls} onView={handleView} />
      <CallDetailsDrawer
        call={selected}
        open={drawerOpen}
        onClose={handleClose}
      />
    </div>
  );
}
