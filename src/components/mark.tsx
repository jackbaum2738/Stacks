export function Mark({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden>
      <rect x="7" y="29" width="34" height="7" rx="2" className="fill-accent" />
      <rect x="11" y="19" width="30" height="7" rx="2" className="fill-accent-2" />
      <rect x="7" y="9" width="26" height="7" rx="2" className="fill-ink" />
    </svg>
  );
}
