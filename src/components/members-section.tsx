"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MemberRow, type StagedValue } from "@/components/member-row";
import { RemoveMemberModal } from "@/components/remove-member-modal";
import { MakeOwnerModal } from "@/components/make-owner-modal";
import { SendInviteForm, type SentInvite } from "@/components/send-invite-form";
import { OpenInviteRow } from "@/components/open-invite-row";

type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEW_ONLY";
type EditableRole = Exclude<Role, "OWNER">;

interface MemberListItem {
  id: string;
  userId: string;
  role: Role;
  user: { name: string | null; email: string };
}

interface Member {
  id: string;
  role: Role;
  user: { name: string | null; email: string };
  isSelf: boolean;
}

function initialStaged(members: Member[]): Record<string, StagedValue> {
  return Object.fromEntries(members.filter((m) => m.role !== "OWNER").map((m) => [m.id, m.role as EditableRole]));
}

/** PATCHes every listed membership to its staged role. Returns which ids succeeded. */
async function saveRoleChanges(
  ids: string[],
  staged: Record<string, StagedValue>
): Promise<{ succeededIds: string[]; failedCount: number }> {
  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        const res = await fetch(`/api/library/members/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: staged[id] }),
        });
        return { id, ok: res.ok };
      } catch {
        return { id, ok: false };
      }
    })
  );
  return {
    succeededIds: results.filter((r) => r.ok).map((r) => r.id),
    failedCount: results.filter((r) => !r.ok).length,
  };
}

/** The role-editing table: staged dropdowns, the single Save/Discard bar, and the Remove/Make-owner modals. */
function MemberList({
  initialMembers,
  canManage,
  isOwnerViewer,
}: {
  initialMembers: Member[];
  canManage: boolean;
  isOwnerViewer: boolean;
}) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [staged, setStaged] = useState<Record<string, StagedValue>>(() => initialStaged(initialMembers));
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [ownerConfirmOpen, setOwnerConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const dirtyIds = useMemo(
    () => members.filter((m) => m.role !== "OWNER" && staged[m.id] !== m.role).map((m) => m.id),
    [members, staged]
  );
  const stagedOwnerId = useMemo(() => members.find((m) => staged[m.id] === "MAKE_OWNER")?.id ?? null, [members, staged]);

  function handleChangeStaged(id: string, value: StagedValue) {
    setSaveError(null);
    setStaged((prev) => ({ ...prev, [id]: value }));
  }

  function discardAll() {
    setSaveError(null);
    setStaged(initialStaged(members));
  }

  async function handleSaveAll() {
    if (stagedOwnerId) {
      setOwnerConfirmOpen(true);
      return;
    }
    setSaving(true);
    setSaveError(null);
    const { succeededIds, failedCount } = await saveRoleChanges(dirtyIds, staged);
    if (succeededIds.length) {
      setMembers((prev) => prev.map((m) => (succeededIds.includes(m.id) ? { ...m, role: staged[m.id] as Role } : m)));
    }
    setSaving(false);
    if (failedCount > 0) {
      setSaveError(
        failedCount === 1 ? "Couldn't save 1 change — try again." : `Couldn't save ${failedCount} changes — try again.`
      );
    } else {
      router.refresh();
    }
  }

  async function confirmMakeOwner() {
    if (!stagedOwnerId) return;
    setSaving(true);
    setSaveError(null);

    const res = await fetch("/api/library/transfer-ownership", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ membershipId: stagedOwnerId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSaving(false);
      setSaveError(data.error ?? "Something went wrong");
      return;
    }

    const previousOwner = members.find((m) => m.role === "OWNER");
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === stagedOwnerId) return { ...m, role: "OWNER" as Role };
        if (previousOwner && m.id === previousOwner.id) return { ...m, role: "ADMIN" as Role };
        return m;
      })
    );
    setStaged((prev) => {
      const next = { ...prev };
      delete next[stagedOwnerId];
      if (previousOwner) next[previousOwner.id] = "ADMIN";
      return next;
    });

    const otherIds = dirtyIds.filter((id) => id !== stagedOwnerId);
    let failedCount = 0;
    if (otherIds.length) {
      const result = await saveRoleChanges(otherIds, staged);
      failedCount = result.failedCount;
      if (result.succeededIds.length) {
        setMembers((prev) =>
          prev.map((m) => (result.succeededIds.includes(m.id) ? { ...m, role: staged[m.id] as Role } : m))
        );
      }
    }

    setSaving(false);
    setOwnerConfirmOpen(false);
    if (failedCount > 0) {
      setSaveError(
        failedCount === 1
          ? "Ownership transferred, but 1 other change couldn't be saved — try again."
          : `Ownership transferred, but ${failedCount} other changes couldn't be saved — try again.`
      );
    } else {
      router.refresh();
    }
  }

  function handleRemoveDone() {
    if (!removeTarget) return;
    const removedId = removeTarget.id;
    setMembers((prev) => prev.filter((m) => m.id !== removedId));
    setStaged((prev) => {
      const next = { ...prev };
      delete next[removedId];
      return next;
    });
    setRemoveTarget(null);
    router.refresh();
  }

  const dirtyCount = dirtyIds.length;
  const ownerTarget = stagedOwnerId ? members.find((m) => m.id === stagedOwnerId) ?? null : null;

  return (
    <>
      <ul className="divide-y divide-line-inner border border-line bg-surface px-4">
        {members.map((m) => (
          <MemberRow
            key={m.id}
            member={{ id: m.id, role: m.role, user: m.user }}
            staged={staged[m.id] ?? m.role}
            canManage={canManage}
            isOwnerViewer={isOwnerViewer}
            isSelf={m.isSelf}
            disableMakeOwner={stagedOwnerId !== null && stagedOwnerId !== m.id}
            onChangeStaged={(value) => handleChangeStaged(m.id, value)}
            onRemove={() => setRemoveTarget(m)}
          />
        ))}
      </ul>

      {dirtyCount > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[2px] border border-accent-2 bg-chip-hover px-3.5 py-2.5">
          <span className="font-mono text-xs tracking-[.02em] text-accent-2">
            {dirtyCount === 1 ? "1 unsaved change" : `${dirtyCount} unsaved changes`}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={discardAll}
              disabled={saving}
              className="rounded-[2px] border border-line-strong px-3.5 py-1.5 font-sans text-sm font-medium text-ink hover:bg-surface disabled:opacity-50"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving}
              className="rounded-[2px] bg-accent-2 px-3.5 py-1.5 font-sans text-sm font-medium text-on-accent hover:brightness-95 disabled:opacity-50"
            >
              Save changes
            </button>
          </div>
        </div>
      )}
      {saveError && !ownerConfirmOpen && <p className="mt-2 font-mono text-xs text-accent">{saveError}</p>}

      {removeTarget && (
        <RemoveMemberModal
          member={{ id: removeTarget.id, name: removeTarget.user.name || removeTarget.user.email }}
          onClose={() => setRemoveTarget(null)}
          onDone={handleRemoveDone}
        />
      )}

      {ownerConfirmOpen && ownerTarget && (
        <MakeOwnerModal
          memberName={ownerTarget.user.name || ownerTarget.user.email}
          otherChangeCount={dirtyIds.filter((id) => id !== stagedOwnerId).length}
          busy={saving}
          error={saveError}
          onCancel={() => {
            setOwnerConfirmOpen(false);
            setSaveError(null);
          }}
          onConfirm={confirmMakeOwner}
        />
      )}
    </>
  );
}

/**
 * Wraps the role-editing member list in a Members / Invitations tab pair -- only for Admin+,
 * who are the only ones who could do anything on the second tab anyway. A Member/View Only
 * viewer just gets the plain list, same as before this existed.
 */
export function MembersSection({
  members,
  canManage,
  isOwnerViewer,
  selfUserId,
  initialInvites,
}: {
  members: MemberListItem[];
  canManage: boolean;
  isOwnerViewer: boolean;
  selfUserId: string;
  initialInvites: SentInvite[];
}) {
  const [tab, setTab] = useState<"members" | "invites">("members");
  const [invites, setInvites] = useState<SentInvite[]>(initialInvites);

  const initialMembers: Member[] = members.map((m) => ({
    id: m.id,
    role: m.role,
    user: m.user,
    isSelf: m.userId === selfUserId,
  }));

  const memberList = <MemberList initialMembers={initialMembers} canManage={canManage} isOwnerViewer={isOwnerViewer} />;

  if (!canManage) return memberList;

  return (
    <div className="space-y-3">
      <div className="flex gap-1 border-b border-line">
        <button
          type="button"
          onClick={() => setTab("members")}
          className={`px-3 py-2 font-mono text-[11px] tracking-[.12em] uppercase ${
            tab === "members" ? "border-b-2 border-ink text-ink" : "text-ink-soft hover:text-ink"
          }`}
        >
          Members
        </button>
        <button
          type="button"
          onClick={() => setTab("invites")}
          className={`px-3 py-2 font-mono text-[11px] tracking-[.12em] uppercase ${
            tab === "invites" ? "border-b-2 border-ink text-ink" : "text-ink-soft hover:text-ink"
          }`}
        >
          Invitations{invites.length > 0 ? ` (${invites.length})` : ""}
        </button>
      </div>

      {tab === "members" ? (
        memberList
      ) : (
        <div className="space-y-4 border border-line bg-surface p-4">
          <SendInviteForm onSent={(invite) => setInvites((prev) => [invite, ...prev])} />
          {invites.length === 0 ? (
            <p className="font-sans text-sm text-ink-soft">No invitations.</p>
          ) : (
            <ul className="divide-y divide-line-inner">
              {invites.map((invite) => (
                <OpenInviteRow
                  key={invite.id}
                  invite={invite}
                  onCancelled={(id) => setInvites((prev) => prev.filter((i) => i.id !== id))}
                  onResent={(id, lastSentAt) =>
                    setInvites((prev) => prev.map((i) => (i.id === id ? { ...i, lastSentAt } : i)))
                  }
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
