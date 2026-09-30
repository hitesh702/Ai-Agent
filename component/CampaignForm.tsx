"use client";

import { useActionState } from "react";
import {
  createCampaignAction,
  updateCampaignAction,
  type FormState,
} from "@/lib/campaigns/actions";
import { CAMPAIGN_DEFAULTS as DEFAULTS } from "@/lib/campaigns/rules";

const initial: FormState = {};

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

type Option = { id: string; name: string };
type LeadOption = Option & { blocked?: string | null };

export type CampaignFormValues = {
  id: string;
  name: string;
  agentId: string;
  leadIds: string[];
  callingDays: string;
  callingWindowStart: string;
  callingWindowEnd: string;
  maxAttempts: number;
  busyRetryMinutes: number;
  retryDelayMinutes: number;
  failedRetryMinutes: number;
  retryOnVoicemail: boolean;
  createFollowUps: boolean;
};

export function CampaignForm({
  agents,
  leads,
  campaign,
  timezone,
}: {
  agents: Option[];
  leads: LeadOption[];
  campaign?: CampaignFormValues;
  timezone: string;
}) {
  const [state, action, pending] = useActionState(
    campaign ? updateCampaignAction.bind(null, campaign.id) : createCampaignAction,
    initial,
  );

  if (agents.length === 0) {
    return <p className="form-error">Create an agent before creating a campaign.</p>;
  }

  const days = new Set<number>(
    campaign ? campaign.callingDays.split(",").map(Number) : DEFAULTS.callingDays,
  );
  const selectedLeads = new Set(campaign?.leadIds ?? []);

  return (
    <form action={action} className="auth-form business-form">
      {state.error ? <p className="form-error">{state.error}</p> : null}
      {state.success ? (
        <p className="form-success">Saved. Mark the campaign ready when you are done.</p>
      ) : null}

      <label>
        Campaign name
        <input
          name="name"
          required
          minLength={2}
          maxLength={120}
          defaultValue={campaign?.name}
          placeholder="NEET evening follow-ups"
        />
      </label>

      <label>
        Agent
        <select name="agentId" required defaultValue={campaign?.agentId ?? agents[0]?.id}>
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
              <input
                type="checkbox"
                name="leadIds"
                value={l.id}
                defaultChecked={selectedLeads.has(l.id)}
              />
              {l.name}
              {l.blocked ? <span className="campaign-muted"> · {l.blocked}, will not be called</span> : null}
            </label>
          ))
        )}
      </fieldset>

      <fieldset className="checkbox-set">
        <legend>Calling schedule ({timezone})</legend>
        <div className="campaign-days">
          {DAYS.map((d) => (
            <label key={d.value} className="checkbox-row">
              <input
                type="checkbox"
                name="callingDays"
                value={d.value}
                defaultChecked={days.has(d.value)}
              />
              {d.label}
            </label>
          ))}
        </div>
        <div className="form-row">
          <label>
            From
            <input
              type="time"
              name="callingWindowStart"
              required
              defaultValue={campaign?.callingWindowStart ?? DEFAULTS.callingWindowStart}
            />
          </label>
          <label>
            Until
            <input
              type="time"
              name="callingWindowEnd"
              required
              defaultValue={campaign?.callingWindowEnd ?? DEFAULTS.callingWindowEnd}
            />
          </label>
        </div>
        <p className="agent-form-note">
          Calls only start inside this window. The same From and Until time means all day.
        </p>
      </fieldset>

      <fieldset className="checkbox-set">
        <legend>Attempts and follow-up rules</legend>
        <label>
          Maximum attempts per lead
          <select name="maxAttempts" defaultValue={campaign?.maxAttempts ?? DEFAULTS.maxAttempts}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="form-row campaign-retry-row">
          <label>
            Retry busy after (min)
            <input
              type="number"
              name="busyRetryMinutes"
              min={15}
              max={10080}
              required
              defaultValue={campaign?.busyRetryMinutes ?? DEFAULTS.busyRetryMinutes}
            />
          </label>
          <label>
            Retry no answer / voicemail after (min)
            <input
              type="number"
              name="retryDelayMinutes"
              min={15}
              max={10080}
              required
              defaultValue={campaign?.retryDelayMinutes ?? DEFAULTS.retryDelayMinutes}
            />
          </label>
          <label>
            Retry failed call after (min)
            <input
              type="number"
              name="failedRetryMinutes"
              min={15}
              max={10080}
              required
              defaultValue={campaign?.failedRetryMinutes ?? DEFAULTS.failedRetryMinutes}
            />
          </label>
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            name="retryOnVoicemail"
            defaultChecked={campaign?.retryOnVoicemail ?? DEFAULTS.retryOnVoicemail}
          />
          Retry when the call reaches voicemail
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            name="createFollowUps"
            defaultChecked={campaign?.createFollowUps ?? DEFAULTS.createFollowUps}
          />
          Schedule a follow-up when the customer asks to be called back
        </label>
        <p className="agent-form-note">
          Busy, unanswered and failed calls are retried only while attempts remain.
          Customers who refuse or ask not to be called are never called again.
        </p>
      </fieldset>

      <p className="agent-form-note">
        Saving never places calls. Calls start only after you mark the campaign
        ready and confirm Start.
      </p>

      <button type="submit" className="primary-btn auth-submit" disabled={pending}>
        {pending ? "Saving…" : campaign ? "Save changes" : "Create campaign"}
      </button>
    </form>
  );
}
