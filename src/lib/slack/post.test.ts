import { describe, expect, it } from "vitest";

import { isSlackWebhookUrl, maskWebhookUrl } from "./post";

describe("isSlackWebhookUrl", () => {
  it("accepts a real Slack webhook", () => {
    expect(
      isSlackWebhookUrl("https://hooks.slack.com/services/T000/B000/abc123"),
    ).toBe(true);
  });

  it("refuses anything off Slack's host", () => {
    // The server makes this request, so a host check is what stops an admin
    // pointing it at something internal.
    for (const url of [
      "https://example.com/hook",
      "http://localhost:3000/admin",
      "http://169.254.169.254/latest/meta-data/",
      "https://hooks.slack.com.evil.test/services/x",
      "file:///etc/passwd",
    ]) {
      expect(isSlackWebhookUrl(url), url).toBe(false);
    }
  });

  it("refuses plain http on Slack's own host", () => {
    expect(isSlackWebhookUrl("http://hooks.slack.com/services/x")).toBe(false);
  });
});

describe("maskWebhookUrl", () => {
  it("keeps only enough to recognise which webhook it is", () => {
    const masked = maskWebhookUrl(
      "https://hooks.slack.com/services/T123/B456/secretpart",
    );
    expect(masked).toBe("https://hooks.slack.com/...etpart");
    expect(masked).not.toContain("secretpart");
    expect(masked).not.toContain("T123");
  });
});
