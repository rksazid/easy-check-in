import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { organization, organizationSettings } from "@/lib/db/schema";
import { context, postToSlack, section, type SlackBlock } from "./post";

async function webhookFor(organizationId: string) {
  const [row] = await db
    .select({
      url: organizationSettings.slackWebhookUrl,
      events: organizationSettings.slackNotifyEvents,
      name: organization.name,
    })
    .from(organizationSettings)
    .innerJoin(
      organization,
      eq(organization.id, organizationSettings.organizationId),
    )
    .where(eq(organizationSettings.organizationId, organizationId))
    .limit(1);

  return row ?? null;
}

/**
 * Posts a "somebody is waiting on you" message, if the organization has Slack
 * set up and has not turned event posts off.
 *
 * Deliberately fire-and-forget from the caller's point of view: approving a
 * join request must not fail because Slack is down.
 */
export async function notifyOrganization(
  organizationId: string,
  message: { text: string; blocks?: SlackBlock[] },
) {
  const target = await webhookFor(organizationId);
  if (!target?.url || !target.events) return;

  await postToSlack(target.url, message);
}

export async function notifyJoinRequest(options: {
  organizationId: string;
  personName: string;
  note: string | null;
  appUrl: string;
}) {
  const blocks = [
    section(
      `*${options.personName}* asked to join *<${options.appUrl}|your organization>*.`,
    ),
    ...(options.note ? [context(`> ${options.note}`)] : []),
    context("Approve or decline it on the organization's admin page."),
  ];

  await notifyOrganization(options.organizationId, {
    text: `${options.personName} asked to join`,
    blocks,
  });
}

export async function notifyPlaceProposed(options: {
  organizationId: string;
  personName: string;
  placeName: string;
  appUrl: string;
}) {
  await notifyOrganization(options.organizationId, {
    text: `${options.personName} added a place: ${options.placeName}`,
    blocks: [
      section(
        `*${options.personName}* added a place, *${options.placeName}*, and it is waiting for approval.`,
      ),
      context(`<${options.appUrl}|Review it>`),
    ],
  });
}
