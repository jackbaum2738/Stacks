import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { consumeEmailChangeToken } from "@/lib/email-change";

export default async function ConfirmEmailPage(props: PageProps<"/confirm-email">) {
  const searchParams = await props.searchParams;
  const token = typeof searchParams.token === "string" ? searchParams.token : null;
  const result = token ? await consumeEmailChangeToken(token) : null;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-bg px-6 py-16">
      <Wordmark />
      <div className="paper-shadow-md w-full max-w-[360px] space-y-[18px] border border-line bg-surface p-7">
        <div className="border-b border-line pb-[10px] font-mono text-[10px] tracking-[.16em] text-ink-soft uppercase">
          Confirm email
        </div>

        {!result ? (
          <>
            <div>
              <h1 className="font-display text-[28px] font-semibold text-ink">Link no longer valid</h1>
              <p className="mt-1 font-sans text-sm text-ink-soft">
                This confirmation link has expired or was cancelled &mdash; request a new one from your profile.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="block w-full rounded-[2px] border border-line py-3 text-center font-sans text-[15px] font-medium text-ink-soft hover:bg-line hover:text-ink"
            >
              Go to dashboard
            </Link>
          </>
        ) : (
          <>
            <div>
              <h1 className="font-display text-[28px] font-semibold text-ink">Email updated</h1>
              <p className="mt-1 font-sans text-sm text-ink-soft">Your Stacks account now uses this address to sign in.</p>
            </div>
            <p className="rounded-[2px] bg-pill-available-bg px-3 py-2 font-mono text-[13px] text-pill-available-fg">{result.email}</p>
            <Link
              href="/dashboard"
              className="block w-full rounded-[2px] bg-accent py-3 text-center font-sans text-[15px] font-medium text-on-accent hover:brightness-95"
            >
              Go to dashboard
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
