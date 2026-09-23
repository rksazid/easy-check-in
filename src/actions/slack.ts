"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db/client";
import { organization, organizationSettings } from "@/lib/db/schema";
import { requireOrgAdmin } from "@/lib/org";
import {
  context,
  header,
  isSlackWebhookUrl,
  postToSlack,
  section,
} from "@/lib/slack/post";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function setSlackWebhook(
  organizationId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireOrgAdmin(organizationId);

  const url = String(formData.get("webhookUrl") ?? "").trim();

  if (!url) return { ok: false, error: "Paste the webhook address first." };
  if (!isSlackWebhookUrl(url)) {
    return {
      ok: false,
      error:
        "That does not look like a Slack webhook. It should start with https://hooks.slack.com/",
    };
  }

  const [org] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);

  // Proved before it is stored, so a typo is caught here rather than silently
  // swallowing every future message.
  const sent = await postToSlack(url, {
    text: `Easy Check-In is now connected to ${org?.name ?? "your organization"}`,
    blocks: [
      header("Easy Check-In is connected"),
      section(
        `Updates for *${org?.name ?? "your organization"}* will arrive in this channel.`,
      ),
      context("An admin can turn this off at any time in the app."),
    ],
  });

  if (!sent.ok) return sent;

  await db
    .insert(organizationSettings)
    .values({ organizationId, slackWebhookUrl: url })
    .onConflictDoUpdate({
      target: organizationSettings.organizationId,
      set: { slackWebhookUrl: url },
    });

  revalidatePath(`/admin/${organizationId}`);
  return { ok: true };
}

export async function clearSlackWebhook(
  organizationId: string,
): Promise<ActionResult> {
  await requireOrgAdmin(organizationId);

  await db
    .update(organizationSettings)
    .set({ slackWebhookUrl: null })
    .where(eq(organizationSettings.organizationId, organizationId));

  revalidatePath(`/admin/${organizationId}`);
  return { ok: true };
}

export async function setSlackNotifyEvents(
  organizationId: string,
  enabled: boolean,
): Promise<ActionResult> {
  await requireOrgAdmin(organizationId);

  await db
    .insert(organizationSettings)
    .values({ organizationId, slackNotifyEvents: enabled })
    .onConflictDoUpdate({
      target: organizationSettings.organizationId,
      set: { slackNotifyEvents: enabled },
    });

  revalidatePath(`/admin/${organizationId}`);
  return { ok: true };
}

export async function sendSlackTestMessage(
  organizationId: string,
): Promise<ActionResult> {
  await requireOrgAdmin(organizationId);

  const [row] = await db
    .select({ url: organizationSettings.slackWebhookUrl })
    .from(organizationSettings)
    .where(eq(organizationSettings.organizationId, organizationId))
    .limit(1);

  if (!row?.url) return { ok: false, error: "No Slack channel is connected." };

  return postToSlack(row.url, {
    text: "Test message from Easy Check-In",
    blocks: [section("Test message from Easy Check-In. The connection works.")],
  });
}
