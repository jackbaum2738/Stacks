const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

/** Every transactional email sends from this identity -- see CLAUDE.md's email setup notes. */
const SENDER = { email: "noreply@stacksonline.com", name: "Stacks" };

/**
 * Sends one transactional email via Brevo's API. Logs and returns rather than throwing when
 * BREVO_API_KEY is unset (local dev without a key configured) or the send fails, since a
 * flaky email provider shouldn't turn into a 500 for the person requesting a password reset --
 * callers that need the outcome should treat this as best-effort.
 */
export async function sendTransactionalEmail(params: {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    // No key configured (expected in local dev) -- log the plain-text body instead of sending,
    // so a developer can still follow a link (e.g. a password reset) from the console.
    console.log(`BREVO_API_KEY is not set -- logging "${params.subject}" to ${params.to.email} instead of sending:\n${params.text}`);
    return;
  }

  try {
    const res = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: SENDER,
        to: [params.to],
        subject: params.subject,
        htmlContent: params.html,
        textContent: params.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`Brevo send failed (${res.status}) for "${params.subject}" to ${params.to.email}:`, body);
    }
  } catch (err) {
    console.error(`Brevo send threw for "${params.subject}" to ${params.to.email}:`, err);
  }
}
