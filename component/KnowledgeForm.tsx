"use client";

import { useActionState } from "react";
import {
  saveBusinessKnowledgeAction,
  type KnowledgeActionState,
} from "@/lib/knowledge/actions";
import { KNOWLEDGE_CATEGORIES } from "@/lib/knowledge/categories";

const initialState: KnowledgeActionState = {};

const FIELD_NAME: Record<string, string> = {
  COURSES: "courses",
  FEES: "fees",
  DURATION: "duration",
  BATCH_TIMING: "batchTiming",
  LOCATION: "location",
  CONTACT: "contact",
  OFFERS: "offers",
  FAQS: "faqs",
  POLICIES: "policies",
};

type Props = {
  businessName: string;
  values: Record<string, string>;
};

export function KnowledgeForm({ businessName, values }: Props) {
  const [state, formAction, pending] = useActionState(
    saveBusinessKnowledgeAction,
    initialState,
  );

  return (
    <form action={formAction} className="auth-form business-form knowledge-form">
      {state.error ? <p className="form-error">{state.error}</p> : null}
      {state.success ? (
        <p className="form-success">
          Knowledge saved. Your AI agent will only use these approved details on
          calls.
        </p>
      ) : null}

      <p className="knowledge-hint">
        Leave a field blank if you do not want the AI to answer that topic. Empty
        fields are never guessed — the agent will say a team member can help.
      </p>

      <label>
        Business name
        <input
          name="businessName"
          type="text"
          required
          defaultValue={businessName}
          placeholder="Your coaching institute name"
        />
      </label>

      {KNOWLEDGE_CATEGORIES.map((cat) => (
        <label key={cat.key}>
          {cat.label}
          <textarea
            name={FIELD_NAME[cat.key]}
            rows={cat.rows}
            defaultValue={values[cat.key] ?? ""}
            placeholder={cat.placeholder}
          />
        </label>
      ))}

      <button type="submit" className="primary-btn auth-submit" disabled={pending}>
        {pending ? "Saving…" : "Save business knowledge"}
      </button>
    </form>
  );
}
