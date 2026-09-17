import { MarkLoader } from "@/components/mark-loader";

/**
 * Full-screen takeover for library switch/create/delete -- same MarkLoader + dimmed-backdrop
 * chrome as the CSV import modal's in-progress state, but with no progress bar: unlike import's
 * many small batched requests, each of these is a single request with no real progress to meter.
 * Mocked up as an Artifact (https://claude.ai/artifact/8TBUxr4MEoFDtzAMZx8Cr6) before building.
 */
export function LibraryLoadingOverlay({ message, hint }: { message: string; hint: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(43,38,32,.45)] p-4">
      <div className="w-full max-w-[340px] rounded-[2px] border border-line-strong bg-surface p-[30px_26px_26px] text-center shadow-[0_24px_44px_rgba(43,38,32,.3)]">
        <div className="mb-[18px] flex justify-center">
          <MarkLoader />
        </div>
        <p className="mb-1 font-display text-lg font-semibold text-ink">{message}</p>
        <p className="mark-loader-caption font-mono text-[11px] tracking-[.04em] text-ink-faint uppercase">{hint}</p>
      </div>
    </div>
  );
}
