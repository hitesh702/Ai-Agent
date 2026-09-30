"use client";

import { useState, useTransition } from "react";
import type { AppointmentStatus } from "@prisma/client";
import { updateAppointmentStatusAction } from "@/lib/appointments/actions";

const ACTIONS: Array<{ status: AppointmentStatus; label: string; secondary?: boolean }> = [
  { status: "CONFIRMED", label: "Confirm" },
  { status: "COMPLETED", label: "Mark completed" },
  { status: "NO_SHOW", label: "Mark no-show", secondary: true },
  { status: "CANCELLED", label: "Cancel appointment", secondary: true },
];

export function AppointmentActions({
  appointmentId,
  allowed,
}: {
  appointmentId: string;
  allowed: AppointmentStatus[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const available = ACTIONS.filter((a) => allowed.includes(a.status));
  if (available.length === 0) {
    return <p className="campaign-muted">No further changes are possible for this appointment.</p>;
  }

  function run(status: AppointmentStatus) {
    if (
      status === "CANCELLED" &&
      !window.confirm("Cancel this appointment? It stays in history and the time becomes free again.")
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateAppointmentStatusAction(appointmentId, status);
      if (result.error) setError(result.error);
    });
  }

  return (
    <>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="appointment-actions">
        {available.map((a) => (
          <button
            key={a.status}
            type="button"
            className={`primary-btn${a.secondary ? " campaign-btn-secondary" : ""}`}
            disabled={pending}
            onClick={() => run(a.status)}
          >
            {a.label}
          </button>
        ))}
      </div>
    </>
  );
}
