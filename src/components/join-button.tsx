"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function JoinButton({ code, label }: { code: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/invite/${code}/accept`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      setBusy(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button
        onClick={join}
        disabled={busy}
        className="w-full rounded-[2px] bg-accent px-4 py-3 font-sans font-medium text-on-accent hover:brightness-95 disabled:opacity-50"
      >
        {busy ? "Joining…" : label}
      </button>
      {error && <p className="font-mono text-xs text-accent">{error}</p>}
    </div>
  );
}
