"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props =
  | { mode: "claim-next"; itemId?: never }
  | { mode: "decide"; itemId: string };

export default function ReviewActions(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function call(path: string, body?: unknown): Promise<void> {
    setBusy(true);
    setError(null);
    const res = await fetch(path, {
      method: "POST",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.message ?? payload.error ?? `Request failed (${res.status})`);
      return;
    }
    router.refresh();
  }

  if (props.mode === "claim-next") {
    return (
      <div className="flex items-center gap-3">
        {error && <span className="text-red-600 text-xs">{error}</span>}
        <button
          type="button"
          disabled={busy}
          onClick={() => call("/api/review-queue/claim")}
          className="bg-black text-white px-3 py-1.5 rounded text-sm disabled:opacity-50"
        >
          {busy ? "Claiming..." : "Claim next"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error && <span className="text-red-600 text-xs">{error}</span>}
      <div className="flex items-center gap-2">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason / note"
          className="border rounded px-2 py-1 text-xs"
        />
        <button
          type="button"
          disabled={busy || reason.trim().length === 0}
          onClick={() =>
            call(`/api/review-queue/${props.itemId}/approve`, {
              note: reason,
            })
          }
          className="bg-green-700 text-white px-2 py-1 rounded text-xs disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={busy || reason.trim().length === 0}
          onClick={() =>
            call(`/api/review-queue/${props.itemId}/reject`, {
              reason,
            })
          }
          className="border border-red-600 text-red-600 px-2 py-1 rounded text-xs disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
