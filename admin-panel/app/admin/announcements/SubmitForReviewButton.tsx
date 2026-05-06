"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SubmitForReviewButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/announcements/${id}/submit-for-review`, {
      method: "POST",
    });
    setBusy(false);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.message ?? payload.error ?? `Request failed (${res.status})`);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end">
      {error && <span className="text-red-600 text-xs">{error}</span>}
      <button
        type="button"
        disabled={busy}
        onClick={onClick}
        className="border border-black px-2 py-1 rounded text-xs disabled:opacity-50"
      >
        {busy ? "Submitting..." : "Submit for review"}
      </button>
    </div>
  );
}
