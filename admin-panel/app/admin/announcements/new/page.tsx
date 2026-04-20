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

const EMPTY: Fields = { titleEn: "", titleAr: "", bodyEn: "", bodyAr: "" };

export default function NewAnnouncementPage() {
  const router = useRouter();
  const [form, setForm] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setTopError(null);
    setSubmitting(true);

    const res = await fetch("/api/announcements", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (res.status === 201) {
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
    <main className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">New announcement</h1>
      {topError && (
        <p className="text-red-600 mb-3 text-sm">{topError}</p>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        {renderField("titleEn", "Title (EN)", "ltr")}
        {renderField("titleAr", "Title (AR)", "rtl")}
        {renderField("bodyEn", "Body (EN)", "ltr", true)}
        {renderField("bodyAr", "Body (AR)", "rtl", true)}
        <button
          type="submit"
          disabled={submitting}
          className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create"}
        </button>
      </form>
    </main>
  );
}
