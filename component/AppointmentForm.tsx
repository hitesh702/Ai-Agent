"use client";

import { useActionState } from "react";
import {
  createAppointmentAction,
  type FormState,
} from "@/lib/appointments/actions";

const initial: FormState = {};

type Option = { id: string; name: string };

export function AppointmentForm({ leads }: { leads: Option[] }) {
  const [state, action, pending] = useActionState(
    createAppointmentAction,
    initial,
  );

  if (leads.length === 0) {
    return <p className="form-error">Add a lead before booking an appointment.</p>;
  }

  return (
    <form action={action} className="auth-form business-form">
      {state.error ? <p className="form-error">{state.error}</p> : null}
      {state.success ? (
        <p className="form-success">Appointment scheduled.</p>
      ) : null}

      <label>
        Lead
        <select name="leadId" required defaultValue={leads[0]?.id}>
          {leads.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>

      <div className="form-row">
        <label>
          Date
          <input name="date" type="date" required />
        </label>
        <label>
          Time
          <input name="time" type="time" />
        </label>
      </div>

      <label>
        Type
        <input name="type" placeholder="counselling / demo" defaultValue="counselling" />
      </label>

      <label>
        Notes
        <textarea name="notes" rows={2} placeholder="Optional notes" />
      </label>

      <button type="submit" className="primary-btn auth-submit" disabled={pending}>
        {pending ? "Saving…" : "Schedule appointment"}
      </button>
    </form>
  );
}
