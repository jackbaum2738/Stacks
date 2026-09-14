export function StatusPill({ status }: { status: "AVAILABLE" | "RESERVED" | "REMOVED" }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-[2px] px-[9px] py-1 font-mono text-[11px] font-medium tracking-[.10em] uppercase ${
        status === "AVAILABLE"
          ? "bg-pill-available-bg text-pill-available-fg"
          : "bg-pill-reserved-bg text-pill-reserved-fg"
      }`}
    >
      {status === "AVAILABLE" ? "Available" : "Reserved"}
    </span>
  );
}
