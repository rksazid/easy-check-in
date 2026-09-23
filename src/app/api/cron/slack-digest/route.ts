import { timingSafeEqual } from "node:crypto";

import { and, eq, gte, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db/client";
import { checkIns, organization, organizationSettings } from "@/lib/db/schema";
import { appUrl } from "@/lib/env";
import { formatHours } from "@/lib/format";
import { previousDayWindow } from "@/lib/reports/month-window";
import { context, header, postToSlack, section } from "@/lib/slack/post";

function authorised(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  // Vercel Cron sends the secret as a bearer token; an external scheduler can
  // send the same header. Compared in constant time either way.
  const offered =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";

  const a = Buffer.from(offered);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const targets = await db
    .select({
      organizationId: organizationSettings.organizationId,
      name: organization.name,
      timezone: organizationSettings.timezone,
      webhookUrl: organizationSettings.slackWebhookUrl,
    })
    .from(organizationSettings)
    .innerJoin(
      organization,
      eq(organization.id, organizationSettings.organizationId),
    )
    .where(isNotNull(organizationSettings.slackWebhookUrl));

  let sent = 0;
  let failed = 0;

  for (const target of targets) {
    if (!target.webhookUrl) continue;

    const { startUtc, endUtc, day } = previousDayWindow(target.timezone);

    const [totals] = await db
      .select({
        seconds: sql<number>`COALESCE(sum(extract(epoch FROM
          ${checkIns.checkedOutAt} - ${checkIns.checkedInAt})), 0)::bigint`,
        visits: sql<number>`count(*)::int`,
        people: sql<number>`count(DISTINCT ${checkIns.userId})::int`,
      })
      .from(checkIns)
      .where(
        and(
          eq(checkIns.organizationId, target.organizationId),
          isNotNull(checkIns.checkedOutAt),
          gte(checkIns.checkedInAt, startUtc),
          lt(checkIns.checkedInAt, endUtc),
        ),
      );

    const [openNow] = await db
      .select({ open: sql<number>`count(*)::int` })
      .from(checkIns)
      .where(
        and(
          eq(checkIns.organizationId, target.organizationId),
          isNull(checkIns.checkedOutAt),
        ),
      );

    const visits = Number(totals?.visits ?? 0);
    const people = Number(totals?.people ?? 0);
    const seconds = Number(totals?.seconds ?? 0);
    const open = Number(openNow?.open ?? 0);

    // A digest saying "nothing happened" every morning trains people to ignore
    // the channel, so quiet days stay quiet.
    if (visits === 0 && open === 0) continue;

    const result = await postToSlack(target.webhookUrl, {
      text: `${target.name}: ${visits} ${visits === 1 ? "visit" : "visits"} on ${day}`,
      blocks: [
        header(`${target.name}, ${day}`),
        section(
          visits === 0
            ? "No completed visits yesterday."
            : [
                `*${formatHours(seconds)}* across *${visits}* ${visits === 1 ? "visit" : "visits"}`,
                `from *${people}* ${people === 1 ? "person" : "people"}.`,
              ].join(" "),
        ),
        ...(open > 0
          ? [
              context(
                `${open} ${open === 1 ? "person is" : "people are"} checked in right now.`,
              ),
            ]
          : []),
        context(
          `<${appUrl()}/admin/${target.organizationId}/reports|Open the report>`,
        ),
      ],
    });

    if (result.ok) sent += 1;
    else failed += 1;
  }

  return NextResponse.json({ organizations: targets.length, sent, failed });
}
