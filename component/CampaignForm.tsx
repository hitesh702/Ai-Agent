"use client";

import { useActionState } from "react";
import {
  createCampaignAction,
  type FormState,
} from "@/lib/campaigns/actions";

const initial: FormState = {};

type Option = { id: string; name: string };

export function CampaignForm({
  agents,
  leads,
}: {
  agents: Option[];
  leads: Option[];
}) {
  const [state, action, pending] = useActionState(createCampaignAction, initial);

  if (agents.length === 0) {
    return <p className="form-error">Create an agent before starting a campaign.</p>;
  }

  return (
    <form action={action} className="auth-form business-form">
      {state.error ? <p className="form-error">{state.error}</p> : null}

      <label>
        Campaign name
        <input name="name" required placeholder="NEET evening follow-ups" />
      </label>

      <label>
        Agent
        <select name="agentId" required defaultValue={agents[0]?.id}>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="checkbox-set">
        <legend>Leads to include</legend>
        {leads.length === 0 ? (
          <p>No leads yet.</p>
        ) : (
          leads.map((l) => (
            <label key={l.id} className="checkbox-row">
              <input type="checkbox" name="leadIds" value={l.id} />
              {l.name}
            </label>
          ))
        )}
      </fieldset>

      <p className="agent-form-note">
        Starting a campaign marks it ACTIVE. Automated dialing ships later — use
        Calls for individual test calls now.
      </p>

      <button type="submit" className="primary-btn auth-submit" disabled={pending}>
        {pending ? "Creating…" : "Create campaign"}
      </button>
    </form>
  );
}
