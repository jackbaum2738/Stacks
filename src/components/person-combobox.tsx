"use client";

import { useEffect, useRef, useState } from "react";

export function PersonCombobox({
  value,
  onChange,
  placeholder = "Reserved for (name)",
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
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
        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-950"
      />
      {open && visibleSuggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-gray-300 bg-white text-sm shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {visibleSuggestions.map((person) => (
            <li key={person}>
              <button
                type="button"
                onClick={() => {
                  onChange(person);
                  setOpen(false);
                  inputRef.current?.focus();
                }}
                className="block w-full px-3 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
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
