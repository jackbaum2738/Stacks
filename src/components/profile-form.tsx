"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formLabelClass, formInputClass } from "@/lib/form-styles";
import { isPasswordValid, isValidEmailShape } from "@/lib/account-validation";
import { PasswordChecklist } from "@/components/password-checklist";
import { ReauthModal } from "@/components/reauth-modal";

type Field = "name" | "username" | "email" | "password";
type PendingAction = { field: Field; payload: Record<string, string> } | null;

function PasswordEye({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? "Hide password" : "Show password"}
      className="absolute top-1/2 right-0 -translate-y-1/2 p-1 text-ink-faint hover:text-ink"
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
  );
}

export function ProfileForm({
  initialName,
  initialUsername,
  initialEmail,
}: {
  initialName: string;
  initialUsername: string;
  initialEmail: string;
}) {
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState(initialUsername);
  const [email, setEmail] = useState(initialEmail);

  const [openField, setOpenField] = useState<Field | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthKey, setReauthKey] = useState(0);
  const [reauthBusy, setReauthBusy] = useState(false);
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Remounts ReauthModal on every open so its internal password field always starts blank,
  // instead of resetting state from an effect.
  function openReauth() {
    setReauthKey((k) => k + 1);
    setReauthOpen(true);
  }

  // Name
  const [nameInput, setNameInput] = useState(initialName);

  // Username
  const [usernameInput, setUsernameInput] = useState(initialUsername);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // Email
  const [emailInput, setEmailInput] = useState("");
  const [emailConfirmInput, setEmailConfirmInput] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  // Password
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pw1Visible, setPw1Visible] = useState(false);
  const [pw2Visible, setPw2Visible] = useState(false);

  function showToast(text: string) {
    setToast(text);
    setTimeout(() => setToast(null), 2200);
  }

  function openInline(field: Field) {
    setOpenField(field);
    if (field === "name") setNameInput(name);
    if (field === "username") {
      setUsernameInput(username);
      setUsernameError(null);
    }
    if (field === "email") {
      setEmailInput("");
      setEmailConfirmInput("");
      setEmailError(null);
    }
    if (field === "password") {
      setPw1("");
      setPw2("");
      setPw1Visible(false);
      setPw2Visible(false);
    }
  }
  function closeInline() {
    setOpenField(null);
  }

  async function saveName() {
    const res = await fetch("/api/account/name", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameInput }),
    });
    if (!res.ok) return;
    setName(nameInput);
    closeInline();
    showToast("Saved.");
    router.refresh();
  }

  async function saveUsername() {
    setUsernameError(null);
    setUsernameChecking(true);
    const res = await fetch(`/api/account/username/available?username=${encodeURIComponent(usernameInput)}`);
    const data = await res.json().catch(() => ({ available: false }));
    setUsernameChecking(false);
    if (!res.ok || !data.available) {
      setUsernameError(data.error ?? "That username is already taken.");
      return;
    }
    setPending({ field: "username", payload: { username: usernameInput } });
    openReauth();
  }

  function saveEmail() {
    setPending({ field: "email", payload: { email: emailInput } });
    openReauth();
  }

  function savePassword() {
    setPending({ field: "password", payload: { newPassword: pw1 } });
    openReauth();
  }

  async function confirmReauth(currentPassword: string) {
    if (!pending) return;
    setReauthBusy(true);
    setReauthError(null);
    const res = await fetch(`/api/account/${pending.field}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...pending.payload, currentPassword }),
    });
    setReauthBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && data.error?.toLowerCase().includes("password")) {
        setReauthError(data.error ?? "That password isn't right");
        return;
      }
      setReauthOpen(false);
      if (pending.field === "username") setUsernameError(data.error ?? "Something went wrong");
      if (pending.field === "email") setEmailError(data.error ?? "Something went wrong");
      setPending(null);
      return;
    }

    setReauthOpen(false);
    if (pending.field === "username") {
      setUsername(pending.payload.username);
      showToast("Saved.");
    } else if (pending.field === "email") {
      setEmail(pending.payload.email);
      showToast("Saved.");
    } else if (pending.field === "password") {
      showToast("Password changed.");
    }
    setPending(null);
    closeInline();
    router.refresh();
  }

  function cancelReauth() {
    setReauthOpen(false);
    setReauthError(null);
    setPending(null);
  }

  const emailShapeOk = isValidEmailShape(emailInput);
  const emailShapeError = emailInput.length > 0 && !emailShapeOk;
  const emailMismatch = emailConfirmInput.length > 0 && emailInput !== emailConfirmInput;
  const emailSaveDisabled = !(emailShapeOk && emailConfirmInput.length > 0 && !emailMismatch);

  const pw1Valid = isPasswordValid(pw1);
  const pwMismatch = pw2.length > 0 && pw1 !== pw2;
  const passwordSaveDisabled = !(pw1Valid && pw2.length > 0 && !pwMismatch);

  return (
    <div className="paper-shadow-md border border-line bg-surface p-7">
      <div className="mb-4 border-b border-line pb-2.5 font-mono text-[10px] tracking-[.16em] text-ink-soft uppercase">
        Your account
      </div>
      <h2 className="font-display text-[22px] font-semibold text-ink">Profile</h2>
      <p className="mt-1 mb-[18px] font-sans text-[13px] text-ink-soft">
        Manage your name, username, email, and password.
      </p>

      {/* Name */}
      <div className="py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className={formLabelClass}>Name</div>
            <div className="font-sans text-[15px] text-ink">{name}</div>
          </div>
          <button onClick={() => openInline("name")} className="font-sans text-[13px] font-semibold text-accent-2 hover:underline">
            Change
          </button>
        </div>
        {openField === "name" && (
          <div className="mt-3.5 flex flex-col gap-3.5 rounded-r-[2px] border-l-[3px] border-accent-2 bg-[color-mix(in_srgb,var(--accent-2)_10%,var(--surface))] p-4">
            <div>
              <label htmlFor="name-input" className={formLabelClass}>
                Name
              </label>
              <input id="name-input" value={nameInput} onChange={(e) => setNameInput(e.target.value)} className={formInputClass} />
            </div>
            <div className="flex gap-2.5">
              <button
                disabled={!nameInput.trim()}
                onClick={saveName}
                className="rounded-[2px] bg-accent px-4 py-[9px] font-sans text-[13px] font-semibold text-on-accent hover:brightness-95 disabled:opacity-40"
              >
                Save
              </button>
              <button onClick={closeInline} className="rounded-[2px] border border-line-strong px-4 py-[9px] font-sans text-[13px] font-semibold text-ink-soft hover:bg-line hover:text-ink">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Username */}
      <div className="border-t border-line py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className={formLabelClass}>Username</div>
            <div className="font-sans text-[15px] text-ink">{username}</div>
          </div>
          <button onClick={() => openInline("username")} className="font-sans text-[13px] font-semibold text-accent-2 hover:underline">
            Change
          </button>
        </div>
        {openField === "username" && (
          <div className="mt-3.5 flex flex-col gap-3.5 rounded-r-[2px] border-l-[3px] border-accent-2 bg-[color-mix(in_srgb,var(--accent-2)_10%,var(--surface))] p-4">
            <div>
              <label htmlFor="username-input" className={formLabelClass}>
                Username
              </label>
              <input
                id="username-input"
                value={usernameInput}
                onChange={(e) => {
                  setUsernameInput(e.target.value);
                  setUsernameError(null);
                }}
                className={formInputClass}
              />
              {usernameChecking && <p className="mt-1 font-sans text-xs text-ink-soft">Checking availability…</p>}
              {usernameError && <p className="mt-1 font-mono text-xs text-accent">{usernameError}</p>}
            </div>
            <div className="flex gap-2.5">
              <button
                disabled={!usernameInput.trim() || usernameChecking}
                onClick={saveUsername}
                className="rounded-[2px] bg-accent px-4 py-[9px] font-sans text-[13px] font-semibold text-on-accent hover:brightness-95 disabled:opacity-40"
              >
                Save
              </button>
              <button onClick={closeInline} className="rounded-[2px] border border-line-strong px-4 py-[9px] font-sans text-[13px] font-semibold text-ink-soft hover:bg-line hover:text-ink">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Email */}
      <div className="border-t border-line py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className={formLabelClass}>Email</div>
            <div className="font-sans text-[15px] text-ink">{email}</div>
          </div>
          <button onClick={() => openInline("email")} className="font-sans text-[13px] font-semibold text-accent-2 hover:underline">
            Change
          </button>
        </div>
        {openField === "email" && (
          <div className="mt-3.5 flex flex-col gap-3.5 rounded-r-[2px] border-l-[3px] border-accent-2 bg-[color-mix(in_srgb,var(--accent-2)_10%,var(--surface))] p-4">
            <div>
              <label htmlFor="email-input" className={formLabelClass}>
                New email
              </label>
              <input
                id="email-input"
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className={formInputClass}
              />
            </div>
            <div>
              <label htmlFor="email-confirm-input" className={formLabelClass}>
                Confirm new email
              </label>
              <input
                id="email-confirm-input"
                type="email"
                value={emailConfirmInput}
                onChange={(e) => setEmailConfirmInput(e.target.value)}
                className={formInputClass}
              />
              {emailShapeError && <p className="mt-1 font-mono text-xs text-accent">Enter a valid email.</p>}
              {!emailShapeError && emailMismatch && <p className="mt-1 font-mono text-xs text-accent">Emails don&apos;t match.</p>}
              {emailError && <p className="mt-1 font-mono text-xs text-accent">{emailError}</p>}
            </div>
            <div className="flex gap-2.5">
              <button
                disabled={emailSaveDisabled}
                onClick={saveEmail}
                className="rounded-[2px] bg-accent px-4 py-[9px] font-sans text-[13px] font-semibold text-on-accent hover:brightness-95 disabled:opacity-40"
              >
                Save
              </button>
              <button onClick={closeInline} className="rounded-[2px] border border-line-strong px-4 py-[9px] font-sans text-[13px] font-semibold text-ink-soft hover:bg-line hover:text-ink">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Password */}
      <div className="border-t border-line py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className={formLabelClass}>Password</div>
            <div className="font-mono text-[15px] tracking-[.18em] text-ink">••••••••••••</div>
          </div>
          <button onClick={() => openInline("password")} className="font-sans text-[13px] font-semibold text-accent-2 hover:underline">
            Change
          </button>
        </div>
        {openField === "password" && (
          <div className="mt-3.5 flex flex-col gap-3.5 rounded-r-[2px] border-l-[3px] border-accent-2 bg-[color-mix(in_srgb,var(--accent-2)_10%,var(--surface))] p-4">
            <div>
              <label htmlFor="pw1-input" className={formLabelClass}>
                New password
              </label>
              <div className="relative">
                <input
                  id="pw1-input"
                  type={pw1Visible ? "text" : "password"}
                  value={pw1}
                  onChange={(e) => setPw1(e.target.value)}
                  className={`${formInputClass} pr-7`}
                />
                <PasswordEye visible={pw1Visible} onToggle={() => setPw1Visible((v) => !v)} />
              </div>
              <PasswordChecklist password={pw1} />
            </div>
            <div>
              <label htmlFor="pw2-input" className={formLabelClass}>
                Confirm new password
              </label>
              <div className="relative">
                <input
                  id="pw2-input"
                  type={pw2Visible ? "text" : "password"}
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  className={`${formInputClass} pr-7`}
                />
                <PasswordEye visible={pw2Visible} onToggle={() => setPw2Visible((v) => !v)} />
              </div>
              {pwMismatch && <p className="mt-1 font-mono text-xs text-accent">Passwords don&apos;t match.</p>}
            </div>
            <div className="flex gap-2.5">
              <button
                disabled={passwordSaveDisabled}
                onClick={savePassword}
                className="rounded-[2px] bg-accent px-4 py-[9px] font-sans text-[13px] font-semibold text-on-accent hover:brightness-95 disabled:opacity-40"
              >
                Save
              </button>
              <button onClick={closeInline} className="rounded-[2px] border border-line-strong px-4 py-[9px] font-sans text-[13px] font-semibold text-ink-soft hover:bg-line hover:text-ink">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div className="mt-3 flex items-center gap-2 rounded-[2px] bg-ok px-3 py-2 font-sans text-[13px] text-on-accent">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {toast}
        </div>
      )}

      <ReauthModal key={reauthKey} open={reauthOpen} busy={reauthBusy} error={reauthError} onConfirm={confirmReauth} onCancel={cancelReauth} />
    </div>
  );
}
