import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { cancelEmailChangeRequestByToken } from "@/lib/email-change";

export default async function CancelEmailChangePage(props: PageProps<"/cancel-email-change">) {
  const searchParams = await props.searchParams;
  const token = typeof searchParams.token === "string" ? searchParams.token : null;
  const result = token ? await cancelEmailChangeRequestByToken(token) : null;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-bg px-6 py-16">
      <Wordmark />
      <div className="paper-shadow-md w-full max-w-[360px] space-y-[18px] border border-line bg-surface p-7">
        <div className="border-b border-line pb-[10px] font-mono text-[10px] tracking-[.16em] text-ink-soft uppercase">
          Cancel email change
        </div>

        {!result ? (
          <>
            <div>
              <h1 className="font-display text-[28px] font-semibold text-ink">Link no longer valid</h1>
              <p className="mt-1 font-sans text-sm text-ink-soft">
                There&apos;s no pending email change to cancel &mdash; it may have already been verified or cancelled.
              </p>
            </div>
            <Link
              href="/dashboard/profile"
              className="block w-full rounded-[2px] bg-accent py-3 text-center font-sans text-[15px] font-medium text-on-accent hover:brightness-95"
            >
              Go to profile
            </Link>
          </>
        ) : (
          <>
            <div>
              <h1 className="font-display text-[28px] font-semibold text-ink">Change cancelled</h1>
              <p className="mt-1 font-sans text-sm text-ink-soft">
                The request to change your sign-in email to {result.newEmail} has been cancelled. Your account still
                uses its current email.
              </p>
            </div>
            <p className="font-sans text-[13px] text-ink-faint">
              If you didn&apos;t request this change, we recommend changing your password from your profile as well.
            </p>
            <Link
              href="/dashboard/profile"
              className="block w-full rounded-[2px] bg-accent py-3 text-center font-sans text-[15px] font-medium text-on-accent hover:brightness-95"
            >
              Go to profile
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
