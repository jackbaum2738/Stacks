import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { isPasswordResetTokenValid } from "@/lib/password-reset";

export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const searchParams = await props.searchParams;
  const token = typeof searchParams.token === "string" ? searchParams.token : null;
  const valid = token ? await isPasswordResetTokenValid(token) : false;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-bg px-6 py-16">
      <Wordmark />
      <div className="paper-shadow-md w-full max-w-[360px] space-y-[18px] border border-line bg-surface p-7">
        <div className="border-b border-line pb-[10px] font-mono text-[10px] tracking-[.16em] text-ink-soft uppercase">
          Reset password
        </div>

        {!valid || !token ? (
          <>
            <div>
              <h1 className="font-display text-[28px] font-semibold text-ink">Link invalid</h1>
              <p className="mt-1 font-sans text-sm text-ink-soft">
                This link is no longer valid — request a new one to continue.
              </p>
            </div>
            <Link
              href="/forgot-password"
              className="block w-full rounded-[2px] bg-accent py-3 text-center font-sans text-[15px] font-medium text-on-accent hover:brightness-95"
            >
              Request a new link
            </Link>
          </>
        ) : (
          <ResetPasswordForm token={token} />
        )}
      </div>
    </main>
  );
}
