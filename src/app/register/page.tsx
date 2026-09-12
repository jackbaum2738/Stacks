"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
        <div>
          <h1 className="text-2xl font-bold">
            {inviteLibraryName
              ? `${inviterName || "Someone"} invited you to ${inviteLibraryName}`
              : "Create your library"}
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {inviteCode
              ? "Set up your own account to join this shared library."
              : "Set up an account and a library to start scanning books into."}
          </p>
        </div>

        {inviteError && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            {inviteError}
          </p>
        )}

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="space-y-1">
          <label htmlFor="name" className="text-sm font-medium">
            Your name
          </label>
          <input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
          />
          <p className="text-xs text-gray-500">At least 8 characters.</p>
        </div>

        {!inviteCode && (
          <div className="space-y-1">
            <label htmlFor="libraryName" className="text-sm font-medium">
              Library name
            </label>
            <input
              id="libraryName"
              required
              placeholder="e.g. Dad's Library"
              value={libraryName}
              onChange={(e) => setLibraryName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || Boolean(inviteError)}
          className="w-full rounded-lg bg-gray-900 px-4 py-2 font-medium text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
        >
          {submitting ? "Creating…" : inviteLibraryName ? `Join ${inviteLibraryName}` : "Create library"}
        </button>

        <p className="text-center text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{" "}
          <Link href={inviteCode ? `/login?next=${encodeURIComponent(`/join/${inviteCode}`)}` : "/login"} className="font-medium underline">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
