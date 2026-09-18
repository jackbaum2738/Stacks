import { emailColors, emailFonts, escapeHtml, renderEmailLayout } from "./shared";

/** Builds the password-reset email's subject, HTML, and plain-text body. */
export function buildPasswordResetEmail(params: {
  username: string;
  resetUrl: string;
  origin: string;
}): { subject: string; html: string; text: string } {
  const { username, resetUrl, origin } = params;
  const c = emailColors;
  const f = emailFonts;
  const safeUsername = escapeHtml(username);
  const safeResetUrl = escapeHtml(resetUrl);

  const bodyHtml = `
<h1 style="margin:0 0 16px 0;font-family:${f.display};font-size:28px;line-height:1.25;font-weight:700;color:${c.ink};">
Reset your password
</h1>
<p style="margin:0 0 22px 0;font-family:${f.body};font-size:15px;line-height:1.6;color:${c.inkMuted};">
We received a request to reset the password for your Stacks account (<span style="font-family:${f.mono};color:${c.ink};">${safeUsername}</span>). Click the button below to choose a new one.
</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;">
<tr>
<td style="background-color:${c.accent};border-radius:2px;">
<a href="${safeResetUrl}" style="display:inline-block;padding:13px 28px;font-family:${f.body};font-size:15px;font-weight:700;color:${c.onAccent};text-decoration:none;">Reset password</a>
</td>
</tr>
</table>
<p style="margin:0 0 8px 0;font-family:${f.body};font-size:12px;color:${c.inkSoft};">
Or copy and paste this link into your browser:
</p>
<p style="margin:0 0 28px 0;font-family:${f.mono};font-size:12.5px;color:${c.accent2};background-color:${c.manila};border:1px solid ${c.manilaLine};border-radius:2px;padding:10px 12px;word-break:break-all;">
${safeResetUrl}
</p>
<div style="border-top:1px solid ${c.line};margin:0 0 22px 0;"></div>
<p style="margin:0 0 6px 0;font-family:${f.body};font-size:13px;color:${c.inkSoft};">
This link expires in 1 hour. If it's expired, you can <a href="${origin}/forgot-password" style="color:${c.accent2};text-decoration:underline;">request a new one</a>.
</p>
<p style="margin:0;font-family:${f.body};font-size:13px;line-height:1.55;color:${c.inkFaint};">
If you didn't request a password reset, you can safely ignore this email — your password won't be changed.
</p>`;

  const html = renderEmailLayout({
    previewText: "Reset the password for your Stacks account.",
    bodyHtml,
    origin,
  });

  const text = [
    "Reset your password",
    "",
    `We received a request to reset the password for your Stacks account (${username}). Open this link to choose a new one:`,
    resetUrl,
    "",
    "This link expires in 1 hour. If it's expired, request a new one:",
    `${origin}/forgot-password`,
    "",
    "If you didn't request a password reset, you can safely ignore this email — your password won't be changed.",
    "",
    `Stacks · ${origin.replace(/^https?:\/\//, "")} · ${origin}/privacy`,
  ].join("\n");

  return { subject: "Reset your Stacks password", html, text };
}
