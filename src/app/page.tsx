import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { FullLogo } from "@/components/full-logo";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const [books, shelves, reserved] = await Promise.all([
    prisma.copy.count({ where: { status: { not: "REMOVED" } } }),
    prisma.shelf.count(),
    prisma.copy.count({ where: { status: "RESERVED" } }),
  ]);

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <header className="border-b-2 border-ink bg-surface">
        <div className="mx-auto flex max-w-[920px] items-center justify-between px-8 py-[18px]">
          <FullLogo height={30} />
          <Link href="/login" className="font-sans text-sm font-medium text-accent">
            Sign in
          </Link>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center gap-[30px] px-8 pt-[76px] pb-[88px]">
        <div className="paper-shadow-hero w-full max-w-[660px] border border-line bg-surface px-10 pt-10 pb-[34px]">
          <div className="mb-[26px] flex items-center justify-between border-b border-line pb-3 font-mono text-[11px] tracking-[.14em] text-ink-soft uppercase">
            <span>Home library · est. 2026</span>
            <span>No. 001</span>
          </div>
          <h1 className="font-display text-[60px] leading-[1.02] font-semibold tracking-[-.02em] text-ink">
            The family
            <br />
            library, catalogued
          </h1>
          <p className="mt-4 max-w-[52ch] font-sans text-[17px] leading-[1.65] text-ink-muted">
            Track a home library of physical books: scan them in and out by ISBN, organize them onto
            shelves, and reserve copies for the people they&apos;re headed to.
          </p>
          <div className="mt-7 flex gap-3">
            <Link
              href="/register"
              className="rounded-[2px] bg-accent px-6 py-[13px] font-sans text-[15px] font-medium text-on-accent hover:brightness-95"
            >
              Get started
            </Link>
            <Link
              href="/login"
              className="rounded-[2px] border border-ink px-6 py-[13px] font-sans text-[15px] font-medium text-ink hover:bg-chip-hover"
            >
              Sign in
            </Link>
          </div>
        </div>
        <div className="flex gap-[26px] font-mono text-[11px] tracking-[.10em] text-ink-soft uppercase">
          <span>{books} books</span>
          <span>{shelves} shelves</span>
          <span>{reserved} reserved</span>
        </div>
      </main>
    </div>
  );
}
