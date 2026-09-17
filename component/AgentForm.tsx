"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Agent, AgentLanguage } from "@prisma/client";
import {
  createAgentAction,
  updateAgentAction,
  type AgentActionState,
} from "@/lib/agents/actions";

const initialState: AgentActionState = {};

const LANGUAGES: { value: AgentLanguage; label: string }[] = [
  { value: "HINGLISH", label: "Hinglish" },
  { value: "HINDI", label: "Hindi" },
  { value: "ENGLISH", label: "English" },
];

type Props = {
  mode: "create" | "edit";
  agent?: Agent | null;
  businessName?: string;
};

export function AgentForm({ mode, agent, businessName }: Props) {
  const boundUpdate = updateAgentAction.bind(null, agent?.id ?? "");
  const action = mode === "create" ? createAgentAction : boundUpdate;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="auth-form business-form agent-form">
      {state.error ? <p className="form-error">{state.error}</p> : null}
      {state.success ? <p className="form-success">Agent saved.</p> : null}

      <div className="form-row">
        <label>
          Agent name
          <input
            name="name"
            type="text"
            required
            defaultValue={agent?.name ?? ""}
            placeholder="Admissions Assistant"
          />
        </label>
        <label>
          Language
          <select name="language" defaultValue={agent?.language ?? "HINGLISH"}>
            {LANGUAGES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="form-row">
        <label>
          Voice ID (optional)
          <input
            name="voice"
            type="text"
            defaultValue={agent?.voice ?? ""}
            placeholder="sarah"
          />
        </label>
        <label>
          Active
          <select
            name="active"
            defaultValue={agent?.active === false ? "false" : "true"}
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>
      </div>

      <label>
        Objective
        <input
          name="objective"
          type="text"
          defaultValue={agent?.objective ?? ""}
          placeholder="Qualify NEET enquiries and book a counselling slot"
        />
      </label>

      <label>
        System prompt
        <textarea
          name="systemPrompt"
          rows={4}
          defaultValue={
            agent?.systemPrompt ??
            `You represent ${businessName ?? "the business"}. Be polite, concise, and accurate.`
          }
          placeholder="Tone, rules, what to ask, what not to promise…"
        />
      </label>

      <p className="agent-form-note">
        Course, fees, timings and FAQs are managed in{" "}
        <Link href="/dashboard/knowledge">Business knowledge</Link>. The AI only
        uses what you approve there — it will not invent missing details.
      </p>

      <div className="agent-form-actions">
        <button type="submit" className="primary-btn auth-submit" disabled={pending}>
          {pending
            ? "Saving…"
            : mode === "create"
              ? "Create agent"
              : "Save changes"}
        </button>
        <Link href="/dashboard/agents" className="agent-cancel">
          Cancel
        </Link>
      </div>
    </form>
  );
}
