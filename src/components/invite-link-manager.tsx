"use client";

import { useEffect, useState } from "react";

export function InviteLinkManager() {
  const [inviteCode, setInviteCode] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/library/invite")
      .then((res) => (res.ok ? res.json() : { inviteCode: null }))
      .then((data) => setInviteCode(data.inviteCode ?? null));
  }, []);

  async function generate() {
    setBusy(true);
    const res = await fetch("/api/library/invite", { method: "POST" });
    const data = await res.json();
    setInviteCode(data.inviteCode ?? null);
    setBusy(false);
    setCopied(false);
  }

  const link = inviteCode && typeof window !== "undefined" ? `${window.location.origin}/join/${inviteCode}` : "";

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <div>
        <h2 className="font-semibold">Invite link</h2>
        <p className="text-sm text-gray-500">
          Anyone with this link can create an account (or sign in) and join this library.
        </p>
      </div>

      {inviteCode === undefined ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : inviteCode ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
            className="min-w-0 flex-1 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <button
            onClick={() => {
              navigator.clipboard.writeText(link).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium dark:border-gray-700"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={generate}
            disabled={busy}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-red-700 dark:border-gray-700 dark:text-red-400"
          >
            Regenerate (invalidates old link)
          </button>
        </div>
      ) : (
        <button
          onClick={generate}
          disabled={busy}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-gray-900"
        >
          {busy ? "Generating…" : "Generate invite link"}
        </button>
      )}
    </div>
  );
}
