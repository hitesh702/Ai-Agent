"use client";

import { useActionState } from "react";
import {
  createBusinessAction,
  updateBusinessAction,
  type BusinessActionState,
} from "@/lib/business/actions";
import type { Business } from "@prisma/client";

const initialState: BusinessActionState = {};

type Props = {
  mode: "create" | "edit";
  business?: Business | null;
};

export function BusinessForm({ mode, business }: Props) {
  const action = mode === "create" ? createBusinessAction : updateBusinessAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="auth-form business-form">
      {state.error ? <p className="form-error">{state.error}</p> : null}
      {state.success ? (
        <p className="form-success">Business profile saved.</p>
      ) : null}

      <label>
        Business name
        <input
          name="name"
          type="text"
          required
          defaultValue={business?.name ?? ""}
          placeholder="ABC Coaching Institute"
        />
      </label>

      <div className="form-row">
        <label>
          Phone
          <input
            name="phone"
            type="tel"
            defaultValue={business?.phone ?? ""}
            placeholder="+91 98765 43210"
          />
        </label>
        <label>
          Website
          <input
            name="website"
            type="text"
            defaultValue={business?.website ?? ""}
            placeholder="https://yourinstitute.com"
          />
        </label>
      </div>

      <label>
        Address
        <input
          name="address"
          type="text"
          defaultValue={business?.address ?? ""}
          placeholder="FC Road, Pune, Maharashtra, India"
        />
      </label>

      <label>
        Description
        <textarea
          name="description"
          rows={4}
          defaultValue={business?.description ?? ""}
          placeholder="What does your business offer?"
        />
      </label>

      <button type="submit" className="primary-btn auth-submit" disabled={pending}>
        {pending
          ? "Saving…"
          : mode === "create"
            ? "Save & open dashboard"
            : "Save changes"}
      </button>
    </form>
  );
}
