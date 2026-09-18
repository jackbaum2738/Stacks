import Link from "next/link";
import { FullLogo } from "@/components/full-logo";
import packageJson from "../../package.json";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-[920px] flex-wrap items-center justify-between gap-3 px-6 py-4">
        <Link href="/dashboard" className="hover:opacity-80">
          <FullLogo height={20} />
        </Link>
        <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-ink-faint">
          <Link
            href="/privacy"
            className="text-ink-soft underline decoration-line-strong underline-offset-2 hover:text-accent-2 hover:decoration-accent-2"
          >
            Privacy
          </Link>
          <span aria-hidden>·</span>
          <span>&copy; {year} Jack Baum</span>
          <span aria-hidden>·</span>
          <span>v{packageJson.version}</span>
        </div>
      </div>
    </footer>
  );
}
