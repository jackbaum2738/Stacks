"use client";

import { useSearchParams } from "next/navigation";
import { InviteAcceptOverlay } from "@/components/invite-accept-overlay";

/**
 * A library-less user (a brand-new account, or one removed from their last library) normally
 * sees the "create your first library" prompt. If they got here via an invite link instead
 * (`?invite=`), show the accept-invite popup in its place -- per Jack's "instead of the new
 * library popup" instruction for a new account that signed up through an invite.
 */
export function ZeroLibraryContent({ fallback }: { fallback: React.ReactNode }) {
  const searchParams = useSearchParams();
  if (searchParams.get("invite")) {
    return <InviteAcceptOverlay variant="inline" />;
  }
  return <>{fallback}</>;
}
