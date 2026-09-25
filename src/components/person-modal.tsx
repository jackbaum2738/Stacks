"use client";

import { useState } from "react";
import { formLabelClass, formInputClass } from "@/lib/form-styles";
import { DeletePersonModal } from "@/components/delete-person-modal";

export interface PersonRecord {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  birthday: string | null; // yyyy-mm-dd
  activeReservationCount: number;
}

function formatBirthdayInput(birthday: string | null): string {
  return birthday ? birthday.slice(0, 10) : "";
}

/**
 * Add/edit a person. Only Name is required -- email is the sole field that has to be
 * unique per library (and can still be left blank). View Only gets a read-only version
 * with no Save/Remove, matching how every other edit surface treats that role.
 */
export function PersonModal({
  person,
  canEdit,
  code,
  onClose,
  onSaved,
  onDeleted,
}: {
  person: PersonRecord | null; // null = "add person"
  canEdit: boolean;
  code: string;
  onClose: () => void;
  onSaved: (person: PersonRecord) => void;
  onDeleted: (id: string) => void;
}) {
  const [name, setName] = useState(person?.name ?? "");
  const [email, setEmail] = useState(person?.email ?? "");
  const [phone, setPhone] = useState(person?.phone ?? "");
  const [location, setLocation] = useState(person?.location ?? "");
  const [birthday, setBirthday] = useState(formatBirthdayInput(person?.birthday ?? null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function save() {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setBusy(true);
    setError(null);

    const body = {
      name: trimmedName,
      email: email.trim(),
      phone: phone.trim(),
      location: location.trim(),
      birthday: birthday.trim(),
    };

    const res = await fetch(person ? `/api/${code}/people/${person.id}` : `/api/${code}/people`, {
      method: person ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Couldn't save this person");
      return;
    }
    onSaved(data.person);
  }

  if (!canEdit) {
    if (!person) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(43,38,32,.45)] p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="w-full max-w-[400px] rounded-[2px] border border-line-strong bg-surface p-[26px] shadow-[0_24px_44px_rgba(43,38,32,.3)]">
          <div className="mb-2 font-mono text-[11px] tracking-[.14em] text-ink-soft uppercase">Person &middot; View only</div>
          <h2 className="mb-3 font-display text-2xl font-semibold text-ink">{person.name}</h2>
          <dl className="mb-5 space-y-1.5 font-sans text-sm text-ink-soft">
            <div>
              <dt className="inline text-ink-faint">Email: </dt>
              <dd className="inline text-ink">{person.email || "—"}</dd>
            </div>
            <div>
              <dt className="inline text-ink-faint">Phone: </dt>
              <dd className="inline text-ink">{person.phone || "—"}</dd>
            </div>
            <div>
              <dt className="inline text-ink-faint">Location: </dt>
              <dd className="inline text-ink">{person.location || "—"}</dd>
            </div>
            <div>
              <dt className="inline text-ink-faint">Birthday: </dt>
              <dd className="inline text-ink">{person.birthday ? formatBirthdayInput(person.birthday) : "—"}</dd>
            </div>
          </dl>
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className="rounded-[2px] border border-line-strong px-3 py-2 font-sans text-sm font-medium text-ink hover:bg-chip-hover">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(43,38,32,.45)] p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="w-full max-w-[420px] rounded-[2px] border border-line-strong bg-surface p-[26px] shadow-[0_24px_44px_rgba(43,38,32,.3)]">
          <div className="mb-2 font-mono text-[11px] tracking-[.14em] text-accent-2 uppercase">Person</div>
          <h2 className="mb-1 font-display text-2xl font-semibold text-ink">{person ? "Edit person" : "Add person"}</h2>
          <p className="mb-5 font-sans text-sm text-ink-soft">
            {person ? "Update their details, or remove them entirely." : "Only a name is required — everything else can stay blank."}
          </p>

          <div className="space-y-3">
            <div>
              <label className={formLabelClass}>
                Name <span className="text-accent">*</span>
              </label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hans Richter" className={formInputClass} />
            </div>
            <div>
              <label className={formLabelClass}>Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="optional, but must be unique" className={formInputClass} />
              {error && <p className="mt-1.5 font-mono text-xs text-accent">{error}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={formLabelClass}>Phone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="optional" className={formInputClass} />
              </div>
              <div>
                <label className={formLabelClass}>Location</label>
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="optional" className={formInputClass} />
              </div>
            </div>
            <div>
              <label className={formLabelClass}>Birthday</label>
              <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className={formInputClass} />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-2">
            {person ? (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="rounded-[2px] px-0 py-2 font-sans text-sm font-semibold text-accent hover:underline"
              >
                Remove
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="rounded-[2px] border border-line-strong px-3 py-2 font-sans text-sm font-medium text-ink hover:bg-chip-hover">
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !name.trim()}
                onClick={save}
                className="rounded-[2px] bg-accent px-3 py-2 font-sans text-sm font-medium text-on-accent hover:brightness-95 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {confirmingDelete && person && (
        <DeletePersonModal
          person={person}
          code={code}
          onClose={() => setConfirmingDelete(false)}
          onDone={() => {
            setConfirmingDelete(false);
            onDeleted(person.id);
          }}
        />
      )}
    </>
  );
}
