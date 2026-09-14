import { Mark } from "@/components/mark";

export function Wordmark() {
  return (
    <div className="flex items-center gap-3">
      <Mark size={36} />
      <span className="font-display text-[36px] font-semibold text-ink">Stacks</span>
    </div>
  );
}
