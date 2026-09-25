"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateShelfForm({ code }: { code: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/${code}/shelves`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      setSubmitting(false);
      return;
    }

    setName("");
    setSubmitting(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New shelf name"
        required
        className="flex-1 border-b border-line-strong bg-transparent px-0.5 py-2 font-sans text-ink placeholder:text-ink-faint focus-visible:border-accent focus-visible:outline-none"
      />
      <button
        type="submit"
        disabled={submitting}
        className="rounded-[2px] bg-ink px-4 py-2 font-sans font-medium text-surface hover:brightness-95 disabled:opacity-50"
      >
        Add shelf
      </button>
      {error && <p className="self-center font-mono text-xs text-accent">{error}</p>}
    </form>
  );
}
