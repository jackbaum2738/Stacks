/**
 * Animated version of the Mark logo (see mark.tsx) for slow operations -- the three
 * bars drop into place bottom-to-top like books settling onto a shelf, then lift away
 * and repeat. Purely CSS (see the .mark-loader-* rules in globals.css); respects
 * prefers-reduced-motion. Fixed at the size it was designed for (mocked up in a Claude
 * Design canvas at this scale) -- generalize with a size prop if it's ever reused
 * somewhere that needs a different one.
 */
export function MarkLoader({ className = "" }: { className?: string }) {
  return (
    <div className={`relative h-[110px] w-[110px] ${className}`} aria-hidden>
      <div
        className="mark-loader-bar mark-loader-bar-bottom bg-accent"
        style={{ top: 66, left: 16, width: 78, height: 16 }}
      />
      <div
        className="mark-loader-bar mark-loader-bar-middle bg-accent-2"
        style={{ top: 43, left: 25, width: 69, height: 16 }}
      />
      <div
        className="mark-loader-bar mark-loader-bar-top bg-ink"
        style={{ top: 21, left: 16, width: 60, height: 16 }}
      />
    </div>
  );
}
