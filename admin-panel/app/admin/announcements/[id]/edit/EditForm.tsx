"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Fields = {
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
};

type FieldErrors = Partial<Record<keyof Fields, string[]>>;

export default function EditForm({
  id,
  initial,
  canDelete,
}: {
  id: string;
  initial: Fields;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Fields>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setTopError(null);

    const res = await fetch(`/api/announcements/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (res.ok) {
      router.push("/admin/announcements");
      router.refresh();
      return;
    }
    if (res.status === 422) {
      setErrors(body.fieldErrors ?? {});
      return;
    }
    setTopError(body.error ?? `Request failed (${res.status})`);
  }

  async function onDelete() {
    if (!confirm("Delete this announcement?")) return;
    setBusy(true);
    setTopError(null);

    const res = await fetch(`/api/announcements/${id}`, {
      method: "DELETE",
    });
    setBusy(false);

    if (res.ok) {
      router.push("/admin/announcements");
      router.refresh();
      return;
    }
    const body = await res.json().catch(() => ({}));
    setTopError(body.error ?? `Delete failed (${res.status})`);
  }

  function renderField(
    name: keyof Fields,
    label: string,
    dir: "ltr" | "rtl",
    multiline = false
  ) {
    const errs = errors[name];
    return (
      <label className="block">
        <span className="block text-sm font-medium mb-1">{label}</span>
        {multiline ? (
          <textarea
            dir={dir}
            rows={4}
            className="w-full border rounded p-2"
            value={form[name]}
            onChange={(e) => setForm({ ...form, [name]: e.target.value })}
          />
        ) : (
          <input
            dir={dir}
            className="w-full border rounded p-2"
            value={form[name]}
            onChange={(e) => setForm({ ...form, [name]: e.target.value })}
          />
        )}
        {errs && errs.length > 0 && (
          <p className="text-sm text-red-600 mt-1">{errs.join(", ")}</p>
        )}
      </label>
    );
  }

  return (
    <form onSubmit={onSave} className="space-y-4">
      {topError && (
        <p className="text-red-600 text-sm">{topError}</p>
      )}
      {renderField("titleEn", "Title (EN)", "ltr")}
      {renderField("titleAr", "Title (AR)", "rtl")}
      {renderField("bodyEn", "Body (EN)", "ltr", true)}
      {renderField("bodyAr", "Body (AR)", "rtl", true)}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save"}
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="border border-red-600 text-red-600 px-4 py-2 rounded disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
