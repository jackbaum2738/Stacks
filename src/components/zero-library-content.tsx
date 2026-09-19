"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { InviteAcceptOverlay } from "@/components/invite-accept-overlay";

/**
 * A library-less user (a brand-new account, or one removed from their last library) normally
 * sees the "create your first library" prompt. If they have an open invitation instead, show
 * the accept-invite popup in its place -- per Jack's "instead of the new library popup"
 * instruction. The invite can come from the URL (`?invite=`, e.g. a fresh visit to an invite
 * link) or from `pendingInviteToken` (the layout's server-side lookup by email), so a known
 * invitation keeps showing even after navigating to another page and back without that query
 * string. A "Not now" dismissal is tracked locally so it isn't immediately re-shown by the
 * still-open `pendingInviteToken` on the very next render.
 */
export function ZeroLibraryContent({
  fallback,
  pendingInviteToken,
}: {
  fallback: React.ReactNode;
  pendingInviteToken?: string | null;
}) {
  const searchParams = useSearchParams();
  const [dismissed, setDismissed] = useState(false);
  const urlToken = searchParams.get("invite");
  const token = urlToken ?? (dismissed ? null : pendingInviteToken ?? null);

  if (token) {
    return <InviteAcceptOverlay variant="inline" token={token} onDismiss={() => setDismissed(true)} />;
  }
  return <>{fallback}</>;
}
