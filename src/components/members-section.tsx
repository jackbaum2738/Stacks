"use client";

import { useState } from "react";
import { MemberRow } from "@/components/member-row";
import { SendInviteForm, type SentInvite } from "@/components/send-invite-form";
import { OpenInviteRow } from "@/components/open-invite-row";

interface MemberListItem {
  id: string;
  userId: string;
  role: string;
  user: { name: string | null; email: string };
}

/**
 * Wraps the existing Members list in a Members / Open invitations tab pair -- only for Admin+,
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

  const memberList = (
    <ul className="divide-y divide-line-inner border border-line bg-surface px-4">
      {members.map((m) => (
        <MemberRow
          key={m.id}
          member={{ id: m.id, role: m.role, user: m.user }}
          canManage={canManage}
          isOwnerViewer={isOwnerViewer}
          isSelf={m.userId === selfUserId}
        />
      ))}
    </ul>
  );

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
          Open invitations{invites.length > 0 ? ` (${invites.length})` : ""}
        </button>
      </div>

      {tab === "members" ? (
        memberList
      ) : (
        <div className="space-y-4 border border-line bg-surface p-4">
          <SendInviteForm onSent={(invite) => setInvites((prev) => [invite, ...prev])} />
          {invites.length === 0 ? (
            <p className="font-sans text-sm text-ink-soft">No open invitations.</p>
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
