"use client";

import { useEffect, useRef, useState } from "react";

export function PersonCombobox({
  value,
  onChange,
  placeholder = "Reserved for (name)",
  required = false,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  id?: string;
}) {
  const [people, setPeople] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/reservations/people")
      .then((res) => res.json())
      .then((data) => setPeople(data.people ?? []))
      .catch(() => {});
  }, []);

  const query = value.trim().toLowerCase();
  const suggestions = query
    ? people.filter((p) => p.toLowerCase().includes(query) && p.toLowerCase() !== query)
    : people;
  const visibleSuggestions = suggestions.slice(0, 6);

  return (
    <div className="relative min-w-0 flex-1">
      <input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        className="w-full border-b border-line-strong bg-transparent px-0.5 py-1.5 font-sans text-[15px] text-ink placeholder:text-ink-faint focus-visible:border-accent focus-visible:outline-none"
      />
      {open && visibleSuggestions.length > 0 && (
        <ul className="paper-shadow-sm absolute z-10 mt-1 w-full overflow-hidden rounded-[2px] border border-line-strong bg-surface text-sm">
          {visibleSuggestions.map((person) => (
            <li key={person}>
              <button
                type="button"
                onClick={() => {
                  onChange(person);
                  setOpen(false);
                  inputRef.current?.focus();
                }}
                className="block w-full px-3 py-1.5 text-left font-sans text-[14px] text-ink hover:bg-[#f1e7d4]"
              >
                {person}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
