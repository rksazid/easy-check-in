import { requireOrgAdmin } from "@/lib/org";
import { getAttendanceReport } from "@/lib/reports/attendance";
import { csvDocument, csvRow } from "@/lib/reports/csv";
import {
  currentMonth,
  parseMonthKey,
  toMonthKey,
} from "@/lib/reports/month-window";

function hours(seconds: number) {
  return (seconds / 3600).toFixed(2);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  // 404s for anyone who does not administer this organization.
  const { organization } = await requireOrgAdmin(orgId);

  const query = new URL(request.url).searchParams;
  const month =
    parseMonthKey(query.get("month") ?? "") ??
    currentMonth(organization.timezone);

  const report = await getAttendanceReport({
    organizationId: orgId,
    year: month.year,
    month: month.month,
    timeZone: organization.timezone,
    placeId: query.get("place"),
    placeTypeId: Number(query.get("type")) || null,
  });

  const rows = [
    csvRow([
      "Name",
      "Username",
      "Email",
      "Hours",
      "Visits",
      "First in (UTC)",
      "Last out (UTC)",
    ]),
    ...report.members.map((row) =>
      csvRow([
        row.name,
        row.username,
        row.email,
        hours(row.seconds),
        row.visits,
        row.firstIn?.toISOString() ?? "",
        row.lastOut?.toISOString() ?? "",
      ]),
    ),
    csvRow([
      "Total",
      "",
      "",
      hours(report.totals.seconds),
      report.totals.visits,
      "",
      "",
    ]),
  ];

  const monthKey = toMonthKey(month.year, month.month);

  return new Response(csvDocument(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${organization.slug}-attendance-${monthKey}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
