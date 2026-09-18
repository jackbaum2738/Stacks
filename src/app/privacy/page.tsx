import Link from "next/link";
import type { Metadata } from "next";
import { Mark } from "@/components/mark";

export const metadata: Metadata = {
  title: "Privacy — Stacks",
};

export default function PrivacyPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-bg px-6 py-16 text-center">
      <Mark size={30} />
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Privacy notice</h1>
        <p className="mt-2 max-w-[440px] font-sans text-sm text-ink-soft">
          We&apos;re writing a proper privacy notice covering what Stacks collects and why. It
          isn&apos;t live yet — check back soon.
        </p>
      </div>
      <Link
        href="/"
        className="font-mono text-[11px] tracking-wide text-ink-soft uppercase underline decoration-line-strong underline-offset-2 hover:text-accent-2 hover:decoration-accent-2"
      >
        Back to Stacks
      </Link>
    </main>
  );
}
