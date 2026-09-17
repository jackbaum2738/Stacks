"use client";

import { passwordChecks } from "@/lib/account-validation";

const ITEMS: { key: keyof ReturnType<typeof passwordChecks>; label: string }[] = [
  { key: "length", label: "At least 8 characters" },
  { key: "number", label: "Contains a number" },
  { key: "special", label: "Contains a special character" },
];

export function PasswordChecklist({ password }: { password: string }) {
  const checks = passwordChecks(password);
  return (
    <ul className="mt-2 flex flex-col gap-1">
      {ITEMS.map((item) => {
        const met = checks[item.key];
        return (
          <li
            key={item.key}
            className={`flex items-center gap-[7px] font-sans text-xs ${met ? "text-ok" : "text-ink-faint"}`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0" aria-hidden>
              <circle cx="12" cy="12" r="9" />
              {met && <path d="M8 12.5l2.5 2.5L16 9.5" />}
            </svg>
            {item.label}
          </li>
        );
      })}
    </ul>
  );
}
