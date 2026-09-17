"use client";

import { useState, useTransition } from "react";
import { refreshCallFromProviderAction } from "@/lib/calls/actions";

export function RefreshCallButton({ callId }: { callId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <button
        type="button"
        className="primary-btn"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await refreshCallFromProviderAction(callId);
            if (result.error) setError(result.error);
          });
        }}
      >
        {pending ? "Refreshing…" : "Refresh from provider"}
      </button>
      {error ? <p className="form-error" style={{ marginTop: 12 }}>{error}</p> : null}
    </div>
  );
}
