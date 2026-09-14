export function StatusPill({ status }: { status: "AVAILABLE" | "RESERVED" | "REMOVED" }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${
        status === "AVAILABLE"
          ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
      }`}
    >
      {status === "AVAILABLE" ? "Available" : "Reserved"}
    </span>
  );
}
