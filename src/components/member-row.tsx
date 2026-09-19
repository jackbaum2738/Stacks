"use client";

type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEW_ONLY";
type EditableRole = "ADMIN" | "MEMBER" | "VIEW_ONLY";
export type StagedValue = EditableRole | "MAKE_OWNER";

const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEW_ONLY: "View Only",
};

export function MemberRow({
  member,
  staged,
  canManage,
  isOwnerViewer,
  isSelf,
  disableMakeOwner,
  onChangeStaged,
  onRemove,
}: {
  member: { id: string; role: Role; user: { name: string | null; email: string } };
  /** The row's currently-selected (not yet saved) value; "OWNER" for the Owner row, which never renders the select. */
  staged: StagedValue | "OWNER";
  canManage: boolean;
  /** Whether the signed-in viewer is this library's Owner -- only they can offer "Make owner". */
  isOwnerViewer: boolean;
  isSelf: boolean;
  /** True while another row already has "Make owner" staged, so this row's own option is disabled. */
  disableMakeOwner: boolean;
  onChangeStaged: (value: StagedValue) => void;
  onRemove: () => void;
}) {
  const isOwnerRow = member.role === "OWNER";
  const canEditThisRole = canManage && !isOwnerRow;
  const canOfferMakeOwner = isOwnerViewer && member.role === "ADMIN";

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display font-medium text-ink">
            {member.user.name || member.user.email}
            {isSelf && <span className="ml-1.5 font-sans text-sm font-normal text-ink-soft">(you)</span>}
          </p>
          <p className="truncate font-sans text-sm text-ink-soft">{member.user.email}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {canEditThisRole ? (
            <select
              value={staged}
              onChange={(e) => onChangeStaged(e.target.value as StagedValue)}
              className={`w-[122px] rounded-[2px] border bg-bg px-2 py-1 font-mono text-[11px] font-medium tracking-[.08em] uppercase ${
                staged !== member.role ? "border-accent-2 text-accent-2" : "border-line-strong text-ink"
              }`}
            >
              <option value="ADMIN">Admin</option>
              <option value="MEMBER">Member</option>
              <option value="VIEW_ONLY">View Only</option>
              {canOfferMakeOwner && (
                <option value="MAKE_OWNER" disabled={disableMakeOwner}>
                  Make owner&hellip;
                </option>
              )}
            </select>
          ) : (
            <span className="w-[122px] rounded-[2px] bg-bg px-[9px] py-1 text-center font-mono text-[11px] font-medium tracking-[.10em] text-ink-soft uppercase">
              {ROLE_LABEL[member.role] ?? member.role}
            </span>
          )}
          {canManage && !isOwnerRow && (
            <button
              onClick={onRemove}
              className="rounded-[2px] border border-line-strong px-3 py-1.5 font-sans text-sm font-medium text-accent hover:bg-chip-hover"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {staged === "MAKE_OWNER" && (
        <p className="mt-1 font-mono text-xs text-accent-2">
          {member.user.name || member.user.email} will become the owner. You will not be able to change this back
          yourself.
        </p>
      )}
    </li>
  );
}
