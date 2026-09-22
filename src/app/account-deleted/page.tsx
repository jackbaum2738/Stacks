import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

/**
 * Landed on right after DELETE /api/account/delete succeeds -- the session cookie is already
 * cleared server-side by then, so this is a plain public page (not gated by proxy.ts) rather
 * than anything under /dashboard. Copy is Jack's exact wording from reviewing the mockup.
 */
export default function AccountDeletedPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-bg px-6 py-16">
      <Wordmark />
      <div className="paper-shadow-md w-full max-w-[420px] space-y-[18px] border border-line bg-surface p-7 text-center">
        <div className="border-b border-line pb-[10px] font-mono text-[10px] tracking-[.16em] text-ink-soft uppercase">
          Account deleted
        </div>
        <div>
          <h1 className="font-display text-[26px] font-semibold text-ink">Your account has been deleted</h1>
          <p className="mt-2 font-sans text-sm leading-[1.6] text-ink-soft">
            Thanks for managing your library with Stacks. Your account has been deleted but you&apos;re welcome to
            create a new Stacks account anytime.
          </p>
        </div>
        <Link
          href="/login"
          className="block w-full rounded-[2px] border border-line-strong py-3 text-center font-sans text-[15px] font-medium text-ink hover:bg-row-hover"
        >
          Return to sign in
        </Link>
      </div>
    </main>
  );
}
