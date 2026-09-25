import { emailColors, emailFonts, escapeHtml, renderEmailLayout } from "./shared";

/**
 * Builds the "verify your new email" email -- sent only to the NEW address. Deliberately shows
 * no email addresses or usernames beyond the account's own username: this inbox may belong to
 * someone who's never used Stacks, so the wording assumes the reader owns it and wants to sign
 * in with it, rather than framing the change as something a stranger did to them (that's the
 * separate notice email to the OLD address, which does need to explain what's happening).
 */
export function buildEmailChangeVerifyEmail(params: {
  username: string;
  confirmUrl: string;
  origin: string;
}): { subject: string; html: string; text: string } {
  const { username, confirmUrl, origin } = params;
  const c = emailColors;
  const f = emailFonts;
  const safeUsername = escapeHtml(username);
  const safeConfirmUrl = escapeHtml(confirmUrl);

  const bodyHtml = `
<h1 style="margin:0 0 16px 0;font-family:${f.display};font-size:28px;line-height:1.25;font-weight:700;color:${c.ink};">
Verify your email
</h1>
<p style="margin:0 0 22px 0;font-family:${f.body};font-size:15px;line-height:1.6;color:${c.inkMuted};">
You requested to use this address to sign in to your Stacks account (<span style="font-family:${f.mono};color:${c.ink};">${safeUsername}</span>). Click the button below to verify it's yours and finish the change.
</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;">
<tr>
<td style="background-color:${c.accent};border-radius:2px;">
<a href="${safeConfirmUrl}" style="display:inline-block;padding:13px 28px;font-family:${f.body};font-size:15px;font-weight:700;color:${c.onAccent};text-decoration:none;">Verify email</a>
</td>
</tr>
</table>
<p style="margin:0 0 8px 0;font-family:${f.body};font-size:12px;color:${c.inkSoft};">
Or copy and paste this link into your browser:
</p>
<p style="margin:0 0 28px 0;font-family:${f.mono};font-size:12.5px;color:${c.accent2};background-color:${c.manila};border:1px solid ${c.manilaLine};border-radius:2px;padding:10px 12px;word-break:break-all;">
${safeConfirmUrl}
</p>
<div style="border-top:1px solid ${c.line};margin:0 0 22px 0;"></div>
<p style="margin:0 0 6px 0;font-family:${f.body};font-size:13px;color:${c.inkSoft};">
This link expires in 1 hour.
</p>
<p style="margin:0;font-family:${f.body};font-size:13px;line-height:1.55;color:${c.inkFaint};">
If you didn't request this, you can ignore this email.
</p>`;

  const html = renderEmailLayout({
    previewText: "Verify your email to finish changing your Stacks sign-in address.",
    bodyHtml,
    origin,
  });

  const text = [
    "Verify your email",
    "",
    `You requested to use this address to sign in to your Stacks account (${username}). Open this link to verify it's yours and finish the change:`,
    confirmUrl,
    "",
    "This link expires in 1 hour.",
    "",
    "If you didn't request this, you can ignore this email.",
    "",
    `Stacks · ${origin.replace(/^https?:\/\//, "")} · ${origin}/privacy`,
  ].join("\n");

  return { subject: "Verify your email for Stacks", html, text };
}
