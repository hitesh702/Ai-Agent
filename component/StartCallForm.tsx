"use client";

import { useActionState } from "react";
import {
  startTestCallAction,
  type CallActionState,
} from "@/lib/calls/actions";

const initialState: CallActionState = {};

type Option = { id: string; name: string; meta?: string };

type Props = {
  agents: Option[];
  leads: Option[];
  configured: boolean;
};

export function StartCallForm({ agents, leads, configured }: Props) {
  const [state, formAction, pending] = useActionState(
    startTestCallAction,
    initialState,
  );

  if (!configured) {
    return (
      <div className="call-setup-warning">
        <strong>Voice calling is not configured yet.</strong>
        <p>
          Add these to <code>.env</code> and restart the server:
        </p>
        <pre>{`TELEPHONY_PROVIDER=vapi\nVAPI_API_KEY=...\nVAPI_PHONE_NUMBER_ID=...\nAPP_URL=https://your-public-url`}</pre>
        <p>
          Telephony is abstracted — Vapi is Provider A. For local webhooks, use
          ngrok/Cloudflare Tunnel and set <code>APP_URL</code>.
        </p>
      </div>
    );
  }

  if (agents.length === 0 || leads.length === 0) {
    return (
      <p className="form-error">
        Create at least one AI agent and one lead before starting a test call.
      </p>
    );
  }

  return (
    <form action={formAction} className="auth-form business-form">
      {state.error ? <p className="form-error">{state.error}</p> : null}

      <div className="form-row">
        <label>
          AI agent
          <select name="agentId" required defaultValue={agents[0]?.id}>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
                {agent.meta ? ` (${agent.meta})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Lead to call
          <select name="leadId" required defaultValue={leads[0]?.id}>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.name}
                {lead.meta ? ` · ${lead.meta}` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button type="submit" className="primary-btn auth-submit" disabled={pending}>
        {pending ? "Starting call…" : "Start test call"}
      </button>
    </form>
  );
}
