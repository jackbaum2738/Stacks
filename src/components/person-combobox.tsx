"use client";

import { useEffect, useState } from "react";
import { formInputClass } from "@/lib/form-styles";

export interface PersonSummary {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
}

function personDetail(person: Pick<PersonSummary, "email" | "phone" | "location">): string {
  return [person.email, person.phone, person.location].filter(Boolean).join(" · ") || "no details on file";
}

/**
 * Search-and-select against the People directory, with the ability to add a brand new
 * person inline without leaving whatever form this is embedded in (a reservation). Unlike
 * the old free-text "reservedFor" field, selecting is required to produce a real personId
 * -- typing alone (without picking a suggestion or finishing the inline add) clears the
 * current selection so a half-typed name can never be submitted as if it were chosen.
 */
export function PersonCombobox({
  id,
  code,
  selected,
  onChange,
  required = false,
  placeholder = "Start typing a name…",
}: {
  id?: string;
  code: string;
  selected: PersonSummary | null;
  onChange: (person: PersonSummary | null) => void;
  required?: boolean;
  placeholder?: string;
}) {
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [text, setText] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addFields, setAddFields] = useState({ email: "", phone: "", location: "", birthday: "" });
  const [addError, setAddError] = useState<string | null>(null);
  const [addConflict, setAddConflict] = useState<PersonSummary | null>(null);
  const [addBusy, setAddBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/${code}/people`)
      .then((res) => res.json())
      .then((data) => setPeople(data.people ?? []))
      .catch(() => {});
  }, [code]);

  useEffect(() => {
    // One-time sync from the selection prop -- keeps the visible text in step whenever the
    // parent swaps which person is selected (e.g. picking a match, or resetting on close).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(selected?.name ?? "");
  }, [selected]);

  const query = text.trim().toLowerCase();
  const matches = query ? people.filter((p) => p.name.toLowerCase().includes(query)) : people;
  const visible = matches.slice(0, 8);
  const exactMatch = people.some((p) => p.name.toLowerCase() === query);

  function pick(person: PersonSummary) {
    onChange(person);
    setText(person.name);
    setOpen(false);
    setAdding(false);
  }

  function startAdd() {
    setAdding(true);
    setOpen(false);
    setAddError(null);
    setAddConflict(null);
    setAddFields({ email: "", phone: "", location: "", birthday: "" });
  }

  async function createPerson() {
    const name = text.trim();
    if (!name) return;
    setAddBusy(true);
    setAddError(null);
    setAddConflict(null);
    const res = await fetch(`/api/${code}/people`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email: addFields.email || undefined,
        phone: addFields.phone || undefined,
        location: addFields.location || undefined,
        birthday: addFields.birthday || undefined,
      }),
    });
    const data = await res.json();
    setAddBusy(false);
    if (!res.ok) {
      setAddError(data.error ?? "Couldn't add this person");
      if (data.conflictingPersonId) {
        setAddConflict(people.find((p) => p.id === data.conflictingPersonId) ?? null);
      }
      return;
    }
    setPeople((prev) => [...prev, data.person]);
    pick(data.person);
  }

  return (
    <div className="relative min-w-0 flex-1">
      <input
        id={id}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(null);
          setOpen(true);
          setAdding(false);
        }}
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

      {open && (visible.length > 0 || query) && (
        <ul className="paper-shadow-sm absolute z-10 mt-1 max-h-[240px] w-full overflow-y-auto overflow-x-hidden rounded-[2px] border border-line-strong bg-surface text-sm">
          {visible.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(person)}
                className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left hover:bg-chip-hover"
              >
                <span className="font-medium text-ink">{person.name}</span>
                <span className="truncate font-mono text-[11px] text-ink-faint">{personDetail(person)}</span>
              </button>
            </li>
          ))}
          {query && !exactMatch && (
            <li className="border-t border-line-inner">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={startAdd}
                className="block w-full px-3 py-2 text-left font-sans text-sm font-semibold text-accent hover:bg-chip-hover"
              >
                + Add &ldquo;{text.trim()}&rdquo; as a new person
              </button>
            </li>
          )}
        </ul>
      )}

      {selected && !adding && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-[2px] border border-dashed border-line-strong px-3 py-2 font-sans text-sm text-ink-soft">
          <span>
            <strong className="font-semibold text-ink">{selected.name}</strong> — {personDetail(selected)}
          </span>
        </div>
      )}

      {adding && (
        <div className="mt-2 space-y-2 rounded-[2px] border border-line-strong bg-surface-raised p-3">
          <div className="font-mono text-[10px] tracking-[.06em] text-ink-soft uppercase">New person — {text.trim()}</div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={addFields.email}
              onChange={(e) => setAddFields((f) => ({ ...f, email: e.target.value }))}
              placeholder="Email (optional)"
              className={formInputClass}
            />
            <input
              value={addFields.phone}
              onChange={(e) => setAddFields((f) => ({ ...f, phone: e.target.value }))}
              placeholder="Phone (optional)"
              className={formInputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={addFields.location}
              onChange={(e) => setAddFields((f) => ({ ...f, location: e.target.value }))}
              placeholder="Location (optional)"
              className={formInputClass}
            />
            <input
              type="date"
              value={addFields.birthday}
              onChange={(e) => setAddFields((f) => ({ ...f, birthday: e.target.value }))}
              className={formInputClass}
            />
          </div>
          {addError && (
            <p className="font-mono text-xs text-accent">
              {addError}
              {addConflict && (
                <>
                  {" — "}
                  <button type="button" onClick={() => pick(addConflict)} className="font-semibold underline">
                    Use {addConflict.name} instead
                  </button>
                </>
              )}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)} className="font-sans text-sm text-ink-soft">
              Cancel
            </button>
            <button
              type="button"
              disabled={addBusy}
              onClick={createPerson}
              className="rounded-[2px] bg-accent px-3 py-1.5 font-sans text-sm font-medium text-on-accent hover:brightness-95 disabled:opacity-50"
            >
              Create &amp; select
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
