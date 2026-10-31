import { Hand, XCircle } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/avatar";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { CheckInPhotoGallery } from "@/components/check-in-photo-gallery";
import { Elapsed } from "@/components/elapsed";
import { LocalTime } from "@/components/local-time";
import { ManualCheckInDecisionButton } from "@/components/manual-check-in-decision-button";
import { VisitMap } from "@/components/map/visit-map-loader";
import { Badge } from "@/components/ui/badge";
import { formatDistance } from "@/lib/geo/haversine";
import { getVisitDetail } from "@/lib/visits";

export const metadata = { title: "Visit" };

const ENDING_LABEL: Record<string, string> = {
  manual: "You checked out",
  auto_forgot: "Closed automatically after the organization's time limit",
  admin: "An admin closed it",
};

const CAPTURE_LABEL: Record<string, string> = {
  check_in: "Checked in",
  manual: "Stored location",
  check_out: "Checked out",
};

export default async function VisitPage({
  params,
}: PageProps<"/visits/[visitId]">) {
  const { visitId } = await params;
  const visit = await getVisitDetail(visitId);

  const endingLabel = visit.checkoutReason
    ? ENDING_LABEL[visit.checkoutReason]
    : null;

  return (
    <div className="space-y-7">
      <BreadcrumbNav
        backHref={
          visit.viewedAsAdmin ? `/admin/${visit.organizationId}` : "/activity"
        }
        backLabel={
          visit.viewedAsAdmin
            ? `Back to ${visit.organizationName}`
            : "Back to activity"
        }
        items={
          visit.viewedAsAdmin
            ? [
                { label: "Admin", href: "/admin" },
                {
                  label: visit.organizationName,
                  href: `/admin/${visit.organizationId}`,
                },
                { label: "Visit Details" },
              ]
            : [
                { label: "Activity", href: "/activity" },
                { label: visit.placeName },
              ]
        }
      />

      <div className="flex items-start gap-4">
        {visit.placeImageUrl ? (
          <img
            src={visit.placeImageUrl}
            alt={visit.placeName}
            className="border-border/70 size-16 shrink-0 rounded-xl border object-cover shadow-sm"
          />
        ) : null}
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">
              {visit.placeName}
            </h1>
            {visit.isManual ? (
              <Badge
                variant="outline"
                className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 gap-1 text-xs font-medium"
              >
                <Hand className="size-3 text-amber-500" />
                Manual Entry
              </Badge>
            ) : null}
            {visit.status === "rejected" ? (
              <Badge variant="destructive" className="text-xs">
                Rejected
              </Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground text-sm">
            {visit.organizationName}, {visit.typeName}
          </p>
          {visit.placeAddress ? (
            <p className="text-muted-foreground text-sm">{visit.placeAddress}</p>
          ) : null}
        </div>
      </div>

      {visit.status === "rejected" ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-sm">
            <XCircle className="size-4" />
            Check-In Rejected by Administrator
          </div>
          <p className="text-xs text-muted-foreground">
            {visit.rejectionReason
              ? `Reason: ${visit.rejectionReason}`
              : "This visit was rejected by an administrator."}
            {visit.rejectedByName ? ` — reviewed by ${visit.rejectedByName}` : ""}
            {visit.rejectedAt ? ` on ${new Date(visit.rejectedAt).toLocaleDateString()}` : ""}
          </p>
        </div>
      ) : null}

      {visit.viewedAsAdmin && visit.isManual ? (
        <div className="rounded-xl border border-border/70 bg-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold">Manual Entry Review</p>
            <p className="text-xs text-muted-foreground">
              {visit.status === "rejected"
                ? "This visit is rejected. You can restore it if it is legitimate."
                : "This visit was logged manually without GPS. You can reject it if invalid."}
            </p>
          </div>
          <ManualCheckInDecisionButton
            checkInId={visit.id}
            status={visit.status}
            isManual={visit.isManual}
            size="default"
          />
        </div>
      ) : null}

      {visit.viewedAsAdmin ? (
        <div className="border-border/70 flex items-center gap-3 rounded-lg border px-4 py-3">
          <Avatar name={visit.personName} src={visit.personImage} />
          <div>
            <p className="font-medium">{visit.personName}</p>
            <p className="text-muted-foreground text-xs">
              You are seeing this as an admin.
            </p>
          </div>
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Detail label="Arrived">
          <LocalTime value={visit.checkedInAt} />
        </Detail>
        <Detail label="Left">
          {visit.checkedOutAt ? (
            <LocalTime value={visit.checkedOutAt} />
          ) : (
            <Badge>Still here</Badge>
          )}
        </Detail>
        <Detail label="Time there">
          <Elapsed since={visit.checkedInAt} until={visit.checkedOutAt} />
        </Detail>
        <Detail label="Check-in Type">
          <span className="text-xs font-medium">
            {visit.isManual ? "Manual (No GPS)" : "GPS Proximity"}
          </span>
        </Detail>
      </dl>

      {endingLabel ? (
        <p className="text-muted-foreground text-sm">{endingLabel}.</p>
      ) : null}

      {visit.captures.length > 0 ? (
        <VisitMap
          latitude={visit.placeLatitude}
          longitude={visit.placeLongitude}
          radiusM={visit.radiusM}
          points={visit.captures.map((capture) => ({
            id: capture.id,
            latitude: capture.latitude,
            longitude: capture.longitude,
            inside: capture.inside,
          }))}
        />
      ) : null}

      <section className="border-border/70 rounded-lg border p-4">
        <CheckInPhotoGallery
          checkInId={visit.id}
          initialImages={visit.images}
          canUpload={visit.canManage}
          canDelete={visit.canManage}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Location readings</h2>
        <p className="text-muted-foreground text-sm">
          Taken only when a button was pressed. Distance is measured from the
          middle of the place.
        </p>

        {visit.captures.length === 0 ? (
          <p className="text-muted-foreground border-border/70 rounded-lg border border-dashed px-4 py-6 text-center text-sm">
            No readings were recorded for this visit.
          </p>
        ) : (
          <ul className="divide-border/70 border-border/70 divide-y rounded-lg border">
            {visit.captures.map((capture) => (
              <li
                key={capture.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {CAPTURE_LABEL[capture.kind] ?? capture.kind}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    <LocalTime value={capture.createdAt} />
                  </span>
                </span>
                <span className="text-right text-xs">
                  <span className="readout block">
                    {formatDistance(capture.distanceM)} away
                  </span>
                  <span
                    className={
                      capture.inside ? "text-signal" : "text-muted-foreground"
                    }
                  >
                    {capture.inside ? "Inside" : "Outside"}
                    {capture.accuracyM
                      ? `, accurate to ${Math.round(capture.accuracyM)} m`
                      : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border/70 rounded-lg border px-3 py-2.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}
