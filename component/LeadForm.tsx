"use client";

import { useActionState } from "react";
import { createLeadAction, type LeadActionState } from "@/lib/leads/actions";

const initialState: LeadActionState = {};

export function LeadForm() {
  const [state, formAction, pending] = useActionState(createLeadAction, initialState);

  return (
    <form action={formAction} className="auth-form business-form">
      {state.error ? <p className="form-error">{state.error}</p> : null}
      {state.success ? (
        <p className="form-success">Lead saved. You can start a test call now.</p>
      ) : null}

      <div className="form-row">
        <label>
          Lead name
          <input name="name" type="text" required placeholder="Rahul Sharma" />
        </label>
        <label>
          Phone
          <input
            name="phone"
            type="tel"
            required
            placeholder="+91 98765 43210"
          />
        </label>
      </div>

      <label>
        Notes (optional)
        <textarea
          name="notes"
          rows={2}
          placeholder="Enquired about NEET evening batch"
        />
      </label>

      <button type="submit" className="primary-btn auth-submit" disabled={pending}>
        {pending ? "Saving…" : "Add test lead"}
      </button>
    </form>
  );
}
