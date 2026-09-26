import { emailColors, emailFonts, escapeHtml, renderEmailLayout } from "./shared";

type Tip = { title: string; body: string };

const TIPS: Tip[] = [
  {
    title: "Reserve to keep track",
    body: "Reserving a copy marks it as taken, so it can't be given to someone else by mistake.",
  },
  {
    title: "Scan in and out",
    body: "Use a barcode scanner or your phone's camera to add a book by ISBN — Stacks looks up the title and author for you.",
  },
  {
    title: "Bring others in",
    body: "Invite people and give each one the right access, from full admin down to view-only.",
  },
  {
    title: "Organize with shelves",
    body: "Set up shelves that match your real bookcases, so every scanned book has a home.",
  },
];

/** Builds the welcome email's subject, HTML, and plain-text body, sent once on sign-up. */
export function buildWelcomeEmail(params: { username: string; origin: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const { username, origin } = params;
  const c = emailColors;
  const f = emailFonts;
  const safeUsername = escapeHtml(username);
  const dashboardUrl = `${origin}/dashboard`;

  const tipRows: string[] = [];
  for (let i = 0; i < TIPS.length; i += 2) {
    const pair = TIPS.slice(i, i + 2);
    const cells = pair
      .map(
        (tip) => `
<td width="50%" valign="top" style="width:50%;padding:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${c.manila};border:1px solid ${c.manilaLine};border-radius:2px;">
<tr>
<td style="padding:16px 16px 18px 16px;">
<div style="font-family:${f.mono};font-size:10.5px;letter-spacing:0.05em;text-transform:uppercase;color:#4a3a17;opacity:0.75;margin:0 0 6px 0;">Tip</div>
<div style="font-family:${f.display};font-weight:700;font-size:15.5px;color:#4a3a17;margin:0 0 6px 0;">${escapeHtml(tip.title)}</div>
<div style="font-family:${f.body};font-size:13px;line-height:1.5;color:#4a3a17;">${escapeHtml(tip.body)}</div>
</td>
</tr>
</table>
</td>`,
      )
      .join(`<td width="16" style="width:16px;line-height:0;font-size:0;">&nbsp;</td>`);
    tipRows.push(`<tr>${cells}</tr><tr><td colspan="3" height="16" style="line-height:16px;font-size:0;">&nbsp;</td></tr>`);
  }

  const bodyHtml = `
<h1 style="margin:0 0 18px 0;font-family:${f.display};font-weight:700;font-size:28px;line-height:1.25;color:${c.ink};text-align:center;">
Welcome to Stacks
</h1>
<p style="margin:0 0 6px 0;font-family:${f.body};font-size:15px;line-height:1.65;color:${c.ink};">
Hi <span style="font-family:${f.mono};">${safeUsername}</span>,
</p>
<p style="margin:0 0 16px 0;font-family:${f.body};font-size:15px;line-height:1.65;color:${c.inkMuted};">
Welcome to Stacks! You&#39;ve now got a proper home for your whole library — every book, shelf and reservation in one place, ready the moment you need it.
</p>
<p style="margin:0 0 26px 0;font-family:${f.body};font-size:15px;line-height:1.65;color:${c.inkMuted};">
We want you getting the most out of it from day one, so here&#39;s a couple of tips worth knowing before you dive in.
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;">
${tipRows.join("\n")}
</table>
<p style="margin:0 0 14px 0;font-family:${f.body};font-size:14px;line-height:1.5;color:${c.inkMuted};text-align:center;">
Ready to take a look?
</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 16px auto;">
<tr>
<td style="background-color:${c.accent};border-radius:2px;">
<a href="${dashboardUrl}" style="display:inline-block;padding:13px 28px;font-family:${f.body};font-size:15px;font-weight:700;color:${c.onAccent};text-decoration:none;">Head to your shelves</a>
</td>
</tr>
</table>
<p style="margin:0;font-family:${f.body};font-size:12px;line-height:1.6;color:${c.inkFaint};text-align:center;">
Already tracking your collection elsewhere? You can import it in one go from Settings once you&#39;re in.
</p>`;

  const html = renderEmailLayout({
    previewText: "Your library's ready — here's a couple of things worth knowing before you dive in.",
    bodyHtml,
    origin,
  });

  const text = [
    "Welcome to Stacks",
    "",
    `Hi ${username},`,
    "",
    "Welcome to Stacks! You've now got a proper home for your whole library — every book, shelf and reservation in one place, ready the moment you need it.",
    "",
    "We want you getting the most out of it from day one, so here's a couple of tips worth knowing before you dive in.",
    "",
    ...TIPS.flatMap((tip) => [`- ${tip.title}: ${tip.body}`]),
    "",
    `Head to your shelves: ${dashboardUrl}`,
    "",
    "Already tracking your collection elsewhere? You can import it in one go from Settings once you're in.",
    "",
    `Stacks · ${origin.replace(/^https?:\/\//, "")} · ${origin}/privacy`,
  ].join("\n");

  return { subject: "Welcome to Stacks", html, text };
}
