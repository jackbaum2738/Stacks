"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mark } from "@/components/mark";
import { formLabelClass, formInputClass } from "@/lib/form-styles";

export default function RegisterPage(props: PageProps<"/register">) {
  const router = useRouter();
  const searchParams = use(props.searchParams);
  const inviteCode = typeof searchParams.invite === "string" ? searchParams.invite : null;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [libraryName, setLibraryName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [inviteLibraryName, setInviteLibraryName] = useState<string | null>(null);
  const [inviterName, setInviterName] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    if (!inviteCode) return;
    fetch(`/api/invite/${inviteCode}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        setInviteLibraryName(data.libraryName);
        setInviterName(data.inviterName);
      })
      .catch(() => setInviteError("This invite link isn't valid or has been replaced with a new one."));
  }, [inviteCode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        inviteCode ? { name, email, password, inviteCode } : { name, email, password, libraryName }
      ),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      setSubmitting(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-bg px-6 py-16">
      <Mark size={24} />
      <form
        onSubmit={onSubmit}
        className="paper-shadow-md w-full max-w-[360px] space-y-4 border border-line bg-surface p-7"
      >
        <div className="border-b border-line pb-[10px] font-mono text-[10px] tracking-[.16em] text-ink-soft uppercase">
          {inviteCode ? "Invitation" : "Create a library"}
        </div>

        {inviteCode && (
          <span className="inline-block self-start border border-dashed border-[#C89A92] px-2 py-[5px] font-mono text-[10px] tracking-[.16em] text-accent uppercase">
            Invitation
          </span>
        )}

        <div>
          <h1 className="font-display text-2xl leading-tight font-semibold text-ink">
            {inviteLibraryName
              ? `${inviterName || "Someone"} invited you to ${inviteLibraryName}`
              : "Create your library"}
          </h1>
          <p className="mt-1 font-sans text-sm text-ink-soft">
            {inviteCode
              ? "Set up your own account to join this shared library."
              : "Set up an account and a library to start scanning books into."}
          </p>
        </div>

        {inviteError && (
          <p className="rounded-[2px] bg-[#F3E8D2] px-3 py-2 font-mono text-xs text-[#8A4B1E]">
            {inviteError}
          </p>
        )}

        {error && (
          <p className="rounded-[2px] bg-[#F5E2DE] px-3 py-2 font-mono text-xs text-accent">{error}</p>
        )}

        <div className="space-y-1">
          <label htmlFor="name" className={formLabelClass}>
            Your name
          </label>
          <input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={formInputClass}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className={formLabelClass}>
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={formInputClass}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className={formLabelClass}>
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={formInputClass}
          />
          <p className="font-sans text-xs text-ink-faint">At least 8 characters.</p>
        </div>

        {!inviteCode && (
          <div className="space-y-1">
            <label htmlFor="libraryName" className={formLabelClass}>
              Library name
            </label>
            <input
              id="libraryName"
              required
              placeholder="e.g. Dad's Library"
              value={libraryName}
              onChange={(e) => setLibraryName(e.target.value)}
              className={formInputClass}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || Boolean(inviteError)}
          className="w-full rounded-[2px] bg-accent py-3 font-sans text-[15px] font-medium text-on-accent hover:brightness-95 disabled:opacity-50"
        >
          {submitting ? "Creating…" : inviteLibraryName ? `Join ${inviteLibraryName}` : "Create library"}
        </button>

        <p className="text-center font-sans text-sm text-ink-soft">
          Already have an account?{" "}
          <Link
            href={inviteCode ? `/login?next=${encodeURIComponent(`/join/${inviteCode}`)}` : "/login"}
            className="font-medium text-accent"
          >
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
