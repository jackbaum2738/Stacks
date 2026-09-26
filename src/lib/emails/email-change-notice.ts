import { emailColors, emailFonts, escapeHtml, renderEmailLayout } from "./shared";

/**
 * Builds the "email change requested" notice -- sent only to the OLD (current) address, once
 * per genuinely new request (never re-sent on a plain resend of the verification link). This
 * is the one email of the pair that names an address, since the account owner needs to know
 * exactly what's being changed to. It carries its own link -- `cancelUrl`, from a second,
 * independent token that can only cancel the request, never confirm it (see
 * cancelEmailChangeRequestByToken in src/lib/email-change.ts) -- so someone who didn't request
 * this can shut it down straight from this inbox without having to sign in and hunt for the
 * setting themselves.
 */
export function buildEmailChangeNoticeEmail(params: {
  username: string;
  newEmail: string;
  cancelUrl: string;
  origin: string;
}): { subject: string; html: string; text: string } {
  const { username, newEmail, cancelUrl, origin } = params;
  const c = emailColors;
  const f = emailFonts;
  const safeUsername = escapeHtml(username);
  const safeNewEmail = escapeHtml(newEmail);
  const safeCancelUrl = escapeHtml(cancelUrl);

  const bodyHtml = `
<h1 style="margin:0 0 16px 0;font-family:${f.display};font-size:28px;line-height:1.25;font-weight:700;color:${c.ink};">
Email change requested
</h1>
<p style="margin:0 0 10px 0;font-family:${f.body};font-size:15px;line-height:1.6;color:${c.inkMuted};">
We received a request to change the email on your Stacks account (<span style="font-family:${f.mono};color:${c.ink};">${safeUsername}</span>) to:
</p>
<p style="margin:0 0 22px 0;font-family:${f.mono};font-size:14px;color:${c.accent2};background-color:${c.manila};border:1px solid ${c.manilaLine};border-radius:2px;padding:10px 12px;word-break:break-all;">
${safeNewEmail}
</p>
<p style="margin:0 0 22px 0;font-family:${f.body};font-size:14px;line-height:1.6;color:${c.inkMuted};">
The change won't take effect until that address is verified. If this was you, there's nothing else to do.
</p>
<div style="border-top:1px solid ${c.line};margin:0 0 22px 0;"></div>
<p style="margin:0;font-family:${f.body};font-size:13px;line-height:1.55;color:${c.inkFaint};">
<strong style="color:${c.ink};">If this wasn't you</strong>, sign in and cancel it from your profile, or <a href="${safeCancelUrl}" style="color:${c.accent2};font-weight:700;">click here</a> to cancel it directly.
</p>`;

  const html = renderEmailLayout({
    previewText: `A change to ${newEmail} was requested for your Stacks account.`,
    bodyHtml,
    origin,
  });

  const text = [
    "Email change requested",
    "",
    `We received a request to change the email on your Stacks account (${username}) to:`,
    newEmail,
    "",
    "The change won't take effect until that address is verified. If this was you, there's nothing else to do.",
    "",
    "If this wasn't you, sign in and cancel it from your profile, or cancel it directly:",
    cancelUrl,
    "",
    `Stacks · ${origin.replace(/^https?:\/\//, "")} · ${origin}/privacy`,
  ].join("\n");

  return { subject: "Email change requested for your Stacks account", html, text };
}
