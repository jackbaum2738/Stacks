/**
 * Shared header/footer for every Stacks transactional email -- the size of the logo lockup and
 * the footer's content/wording were signed off by Jack against a mockup before this was built
 * (see CLAUDE.md's transactional-email notes) and are meant to stay identical across every
 * email type, not be re-derived per template. Written as classic table-based, inline-styled
 * HTML rather than the app's normal Tailwind/CSS-variable styling, since email clients don't
 * reliably support external stylesheets, CSS custom properties, flexbox/grid, or SVG.
 */

const COLORS = {
  bg: "#efe7d6",
  surface: "#fbf6ea",
  ink: "#2b2620",
  inkMuted: "#4a4238",
  inkSoft: "#756a58",
  inkFaint: "#8b8071",
  line: "#d8c9ae",
  accent: "#9e3b2f",
  accent2: "#2c5a5b",
  onAccent: "#fbf6ea",
  manila: "#f2e6c4",
  manilaLine: "#b99a53",
} as const;

const FONT_DISPLAY = "Georgia, 'Times New Roman', serif";
const FONT_BODY = "Arial, Helvetica, sans-serif";
const FONT_MONO = "'Courier New', Courier, monospace";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** The three-bar Stacks mark stacked with gaps, widest at the bottom, matching src/components/mark.tsx. Built from table cells and divs rather than SVG, since many email clients don't render inline SVG. */
function logoBarsHtml(): string {
  const row = (width: number, color: string, isLast: boolean) => `
    <tr>
      <td align="center" style="padding:${isLast ? "0" : "0 0 3px 0"};">
        <div style="width:${width}px;height:9px;background-color:${color};border-radius:2px;line-height:9px;font-size:0;">&nbsp;</div>
      </td>
    </tr>`;
  // Narrowest bar on top, widest on the bottom -- matches src/components/mark.tsx.
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:collapse;">
    ${row(46, COLORS.ink, false)}
    ${row(53, COLORS.accent2, false)}
    ${row(60, COLORS.accent, true)}
  </table>`;
}

export function renderEmailLayout(params: {
  previewText: string;
  bodyHtml: string;
  origin: string;
}): string {
  const { previewText, bodyHtml, origin } = params;
  const year = new Date().getFullYear();
  const domainHref = origin;
  const domainLabel = origin.replace(/^https?:\/\//, "");
  const privacyHref = `${origin}/privacy`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Stacks</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(previewText)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.bg};">
<tr>
<td align="center" style="padding:40px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;background-color:${COLORS.surface};border:1px solid ${COLORS.line};border-radius:2px;">
<tr>
<td style="padding:44px 40px 36px 40px;font-family:${FONT_BODY};">

<div style="text-align:center;margin:0 0 12px 0;">
${logoBarsHtml()}
</div>
<div style="text-align:center;margin:0 0 40px 0;font-family:${FONT_DISPLAY};font-size:34px;font-weight:700;color:${COLORS.ink};">
Stacks
</div>

${bodyHtml}

</td>
</tr>
</table>

<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;margin-top:18px;">
<tr>
<td align="center" style="font-family:${FONT_MONO};font-size:11.5px;color:${COLORS.inkFaint};padding:0 16px;">
Stacks
&nbsp;&middot;&nbsp;
<a href="${domainHref}" style="color:${COLORS.inkSoft};text-decoration:underline;">${domainLabel}</a>
&nbsp;&middot;&nbsp;
<a href="${privacyHref}" style="color:${COLORS.inkSoft};text-decoration:underline;">Privacy</a>
<br /><br />
&copy; ${year} Jack Baum
</td>
</tr>
</table>

</td>
</tr>
</table>
</body>
</html>`;
}

export const emailColors = COLORS;
export const emailFonts = { display: FONT_DISPLAY, body: FONT_BODY, mono: FONT_MONO };
export { escapeHtml };
