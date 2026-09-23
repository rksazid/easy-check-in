import "server-only";

/**
 * Slack only ever issues webhooks on this host. Checking it is what stops an
 * admin pasting an internal address and turning this into a request forger,
 * since the server is the one making the call.
 */
const SLACK_WEBHOOK_PREFIX = "https://hooks.slack.com/";

const TIMEOUT_MS = 8000;

export type SlackBlock = Record<string, unknown>;

export function isSlackWebhookUrl(value: string) {
  return value.startsWith(SLACK_WEBHOOK_PREFIX);
}

/** Shows enough of a stored webhook to recognise it, never enough to use it. */
export function maskWebhookUrl(url: string) {
  return `${SLACK_WEBHOOK_PREFIX}...${url.slice(-6)}`;
}

export type SlackPostResult = { ok: true } | { ok: false; error: string };

/**
 * Posts one message. Never throws: a Slack outage must not take down the page
 * or the action that triggered it, so failures come back as a value.
 */
export async function postToSlack(
  webhookUrl: string,
  message: { text: string; blocks?: SlackBlock[] },
): Promise<SlackPostResult> {
  if (!isSlackWebhookUrl(webhookUrl)) {
    return { ok: false, error: "That is not a Slack webhook address." };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // `text` is the fallback Slack shows on a phone's lock screen.
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 200);
      return {
        ok: false,
        error:
          response.status === 404
            ? "Slack no longer recognises that webhook. It may have been revoked."
            : `Slack refused the message (${response.status}). ${detail}`.trim(),
      };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach Slack. Try again shortly." };
  }
}

export function section(markdown: string): SlackBlock {
  return { type: "section", text: { type: "mrkdwn", text: markdown } };
}

export function context(markdown: string): SlackBlock {
  return { type: "context", elements: [{ type: "mrkdwn", text: markdown }] };
}

export function header(text: string): SlackBlock {
  return { type: "header", text: { type: "plain_text", text, emoji: true } };
}
