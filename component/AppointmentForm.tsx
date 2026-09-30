"use client";

import { useActionState, useState } from "react";
import {
  createAppointmentAction,
  type FormState,
} from "@/lib/appointments/actions";

const initial: FormState = {};

type Option = { id: string; name: string };
type Slot = { date: string; time: string };

/** "15:30" → "3:30 PM" */
function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** "2026-10-02" → "Fri, Oct 2" */
function formatDay(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function AppointmentForm({
  leads,
  types,
  today,
  timezone,
}: {
  leads: Option[];
  types: readonly string[];
  today: string;
  timezone: string;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [preference, setPreference] = useState("");
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  async function loadSlots(forDate: string, forPreference: string, keepTime = "") {
    setTime(keepTime);
    setSlots(null);
    setSlotError(null);
    if (!forDate) return;

    setLoadingSlots(true);
    try {
      const params = new URLSearchParams({ date: forDate });
      if (forPreference) params.set("preference", forPreference);
      const res = await fetch(`/api/appointments/availability?${params}`);
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setSlotError(body.error ?? "Could not load available times.");
        return;
      }
      setSlots(body.data.slots);
    } catch {
      setSlotError("Could not load available times. Check your connection and try again.");
    } finally {
      setLoadingSlots(false);
    }
  }

  const [state, action, pending] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const result = await createAppointmentAction(prev, formData);
      void loadSlots(String(formData.get("date") ?? ""), preference);
      return result;
    },
    initial,
  );

  function pickAlternative(slot: Slot) {
    setDate(slot.date);
    void loadSlots(slot.date, "", slot.time);
  }

  if (leads.length === 0) {
    return <p className="form-error">Add a lead before booking an appointment.</p>;
  }

  return (
    <form action={action} className="auth-form business-form">
      {state.error ? <p className="form-error">{state.error}</p> : null}
      {state.alternatives?.length ? (
        <div className="appointment-alternatives">
          {state.alternatives.map((slot) => (
            <button
              key={`${slot.date}-${slot.time}`}
              type="button"
              onClick={() => pickAlternative(slot)}
            >
              {formatDay(slot.date)} · {formatTime(slot.time)}
            </button>
          ))}
        </div>
      ) : null}
      {state.success && state.message ? (
        <p className="form-success">{state.message}</p>
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
          Appointment type
          <select name="type" defaultValue={types[0]}>
            {types.map((type) => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Preferred time of day
          <select
            value={preference}
            onChange={(e) => {
              setPreference(e.target.value);
              void loadSlots(date, e.target.value);
            }}
          >
            <option value="">Any time</option>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
          </select>
        </label>
      </div>

      <div className="form-row">
        <label>
          Date
          <input
            name="date"
            type="date"
            required
            min={today}
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              void loadSlots(e.target.value, preference);
            }}
          />
        </label>
        <label>
          Available time
          <select
            name="time"
            required
            value={time}
            onChange={(e) => setTime(e.target.value)}
            disabled={!slots || slots.length === 0}
          >
            <option value="">
              {!date
                ? "Pick a date first"
                : loadingSlots
                  ? "Loading…"
                  : slots && slots.length === 0
                    ? "No free times"
                    : "Choose a time"}
            </option>
            {(slots ?? []).map((slot) => (
              <option key={slot} value={slot}>
                {formatTime(slot)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {slotError ? <p className="form-error">{slotError}</p> : null}
      <p className="appointment-slots-note">
        Only free 30-minute slots inside your calling hours are shown ({timezone}).
        {slots && slots.length === 0 && date
          ? " This day is full or closed — try another date."
          : ""}
      </p>

      <label>
        Notes
        <textarea name="notes" rows={2} placeholder="Optional notes" />
      </label>

      <label className="appointment-agree">
        <input type="checkbox" name="customerAgreed" required />
        The customer agreed to this date and time
      </label>

      <button type="submit" className="primary-btn auth-submit" disabled={pending || !time}>
        {pending ? "Booking…" : "Book appointment"}
      </button>
    </form>
  );
}
