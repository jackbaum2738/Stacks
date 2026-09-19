import type { InvitableRole } from "@/lib/permissions";
import { emailColors, emailFonts, escapeHtml, renderEmailLayout } from "./shared";

const ROLE_LABEL: Record<InvitableRole, string> = {
  ADMIN: "an Admin",
  MEMBER: "a Member",
  VIEW_ONLY: "a View-Only member",
};

/** Builds the library-invite email's subject, HTML, and plain-text body. */
export function buildLibraryInviteEmail(params: {
  inviterUsername: string;
  libraryName: string;
  role: InvitableRole;
  acceptUrl: string;
  origin: string;
}): { subject: string; html: string; text: string } {
  const { inviterUsername, libraryName, role, acceptUrl, origin } = params;
  const c = emailColors;
  const f = emailFonts;
  const roleLabel = ROLE_LABEL[role] ?? role;
  const safeInviter = escapeHtml(inviterUsername);
  const safeLibrary = escapeHtml(libraryName);
  const safeAcceptUrl = escapeHtml(acceptUrl);

  const bodyHtml = `
<h1 style="margin:0 0 16px 0;font-family:${f.display};font-size:28px;line-height:1.25;font-weight:700;color:${c.ink};">
You&#39;re invited to a library
</h1>
<p style="margin:0 0 22px 0;font-family:${f.body};font-size:15px;line-height:1.6;color:${c.inkMuted};">
<span style="font-family:${f.mono};color:${c.ink};">${safeInviter}</span> has invited you to join <strong style="color:${c.ink};">${safeLibrary}</strong> on Stacks as ${roleLabel}.
</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;">
<tr>
<td style="background-color:${c.accent};border-radius:2px;">
<a href="${safeAcceptUrl}" style="display:inline-block;padding:13px 28px;font-family:${f.body};font-size:15px;font-weight:700;color:${c.onAccent};text-decoration:none;">Accept invitation</a>
</td>
</tr>
</table>
<p style="margin:0 0 8px 0;font-family:${f.body};font-size:12px;color:${c.inkSoft};">
Or copy and paste this link into your browser:
</p>
<p style="margin:0 0 28px 0;font-family:${f.mono};font-size:12.5px;color:${c.accent2};background-color:${c.manila};border:1px solid ${c.manilaLine};border-radius:2px;padding:10px 12px;word-break:break-all;">
${safeAcceptUrl}
</p>
<div style="border-top:1px solid ${c.line};margin:0 0 22px 0;"></div>
<p style="margin:0;font-family:${f.body};font-size:13px;color:${c.inkSoft};">
Sign in or create a Stacks account to accept the invitation.
</p>`;

  const html = renderEmailLayout({
    previewText: `${inviterUsername} invited you to join ${libraryName} on Stacks.`,
    bodyHtml,
    origin,
  });

  const text = [
    "You're invited to a library",
    "",
    `${inviterUsername} has invited you to join ${libraryName} on Stacks as ${roleLabel}. Open this link to accept:`,
    acceptUrl,
    "",
    "Sign in or create a Stacks account to accept the invitation.",
    "",
    `Stacks · ${origin.replace(/^https?:\/\//, "")} · ${origin}/privacy`,
  ].join("\n");

  return { subject: `${inviterUsername} invited you to join ${libraryName}`, html, text };
}
