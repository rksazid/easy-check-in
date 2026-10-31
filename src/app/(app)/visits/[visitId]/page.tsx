import Link from "next/link";

import { Avatar } from "@/components/avatar";
import { CheckInPhotoGallery } from "@/components/check-in-photo-gallery";
import { Elapsed } from "@/components/elapsed";
import { LocalTime } from "@/components/local-time";
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
      <div className="flex items-start gap-4">
        {visit.placeImageUrl ? (
          <img
            src={visit.placeImageUrl}
            alt={visit.placeName}
            className="border-border/70 size-16 shrink-0 rounded-xl border object-cover shadow-sm"
          />
        ) : null}
        <div className="min-w-0 space-y-1">
          <Link
            href={visit.viewedAsAdmin ? `/admin/${visit.organizationId}` : "/activity"}
            className="text-muted-foreground text-sm underline-offset-4 hover:underline"
          >
            {visit.viewedAsAdmin ? "Back to the organization" : "Back to activity"}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {visit.placeName}
          </h1>
          <p className="text-muted-foreground text-sm">
            {visit.organizationName}, {visit.typeName}
          </p>
          {visit.placeAddress ? (
            <p className="text-muted-foreground text-sm">{visit.placeAddress}</p>
          ) : null}
        </div>
      </div>

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

      <dl className="grid grid-cols-2 gap-3">
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
        <Detail label="Check-in radius">
          <span className="readout">{visit.radiusM} m</span>
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
