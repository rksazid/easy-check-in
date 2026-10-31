import { asc, desc, eq } from "drizzle-orm";
import Link from "next/link";

import { PendingPlaceActions, PlaceRowActions } from "./place-row-actions";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db/client";
import { organization, places, placeTypes, user } from "@/lib/db/schema";
import { requireMembership } from "@/lib/org";

export async function generateMetadata({
  params,
}: PageProps<"/orgs/[orgId]/places">) {
  const { orgId } = await params;
  await requireMembership(orgId);
  const [org] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1);
  return { title: `Places in ${org?.name ?? "your organization"}` };
}

export default async function PlacesPage({
  params,
}: PageProps<"/orgs/[orgId]/places">) {
  const { orgId } = await params;
  const { session, isAdmin } = await requireMembership(orgId);

  const [org] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1);

  const rows = await db
    .select({
      id: places.id,
      name: places.name,
      address: places.address,
      imageUrl: places.imageUrl,
      latitude: places.latitude,
      longitude: places.longitude,
      radiusM: places.radiusM,
      isActive: places.isActive,
      status: places.status,
      createdBy: places.createdBy,
      typeName: placeTypes.name,
      proposerName: user.name,
      proposerImage: user.image,
    })
    .from(places)
    .innerJoin(placeTypes, eq(places.placeTypeId, placeTypes.id))
    .leftJoin(user, eq(places.createdBy, user.id))
    .where(eq(places.organizationId, orgId))
    .orderBy(desc(places.isActive), asc(places.name));

  // Members see only their own proposals waiting; admins see everyone's.
  const waiting = rows.filter(
    (place) =>
      place.status === "pending" &&
      (isAdmin || place.createdBy === session.user.id),
  );
  const approved = rows.filter(
    (place) => place.status === "approved" && place.isActive,
  );
  const archived = rows.filter(
    (place) => place.status === "approved" && !place.isActive,
  );
  const rejected = rows.filter(
    (place) =>
      place.status === "rejected" &&
      (isAdmin || place.createdBy === session.user.id),
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Link
            href="/orgs"
            className="text-muted-foreground text-sm underline-offset-4 hover:underline"
          >
            Back to organizations
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Places</h1>
          <p className="text-muted-foreground text-sm">
            Where people check in for {org?.name}.
          </p>
        </div>
        <Button asChild>
          <Link href={`/orgs/${orgId}/places/new`}>Add a place</Link>
        </Button>
      </div>

      {!isAdmin ? (
        <p className="text-muted-foreground border-border/70 rounded-lg border border-dashed px-4 py-3 text-sm">
          Anyone here can add a place. An admin checks it before people can
          check in to it.
        </p>
      ) : null}

      {waiting.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">
            Waiting for approval
            <Badge className="ml-2">{waiting.length}</Badge>
          </h2>
          <ul className="divide-border/70 border-border/70 divide-y rounded-lg border">
            {waiting.map((place) => (
              <li
                key={place.id}
                className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  {place.imageUrl ? (
                    <img
                      src={place.imageUrl}
                      alt={place.name}
                      className="border-border/70 size-12 shrink-0 rounded-lg border object-cover"
                    />
                  ) : null}
                  <div className="min-w-0 space-y-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {place.name}
                      <Badge variant="secondary">{place.typeName}</Badge>
                    </p>
                    {place.address ? (
                      <p className="text-muted-foreground text-sm">
                        {place.address}
                      </p>
                    ) : null}
                    <p className="text-muted-foreground readout text-xs">
                      {place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}, within{" "}
                      {place.radiusM} m
                    </p>
                    {isAdmin && place.proposerName ? (
                      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                        <Avatar
                          name={place.proposerName}
                          src={place.proposerImage}
                          className="size-4 text-[8px]"
                        />
                        added by {place.proposerName}
                      </p>
                    ) : null}
                  </div>
                </div>
                <PendingPlaceActions
                  organizationId={orgId}
                  placeId={place.id}
                  name={place.name}
                  canReview={isAdmin}
                  canWithdraw={place.createdBy === session.user.id}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Open for check-in</h2>
        {approved.length === 0 ? (
          <p className="text-muted-foreground border-border/70 rounded-lg border border-dashed px-4 py-10 text-center text-sm">
            No places yet. Add one so people have somewhere to check in.
          </p>
        ) : (
          <ul className="divide-border/70 border-border/70 divide-y rounded-lg border">
            {approved.map((place) => (
              <li
                key={place.id}
                className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  {place.imageUrl ? (
                    <img
                      src={place.imageUrl}
                      alt={place.name}
                      className="border-border/70 size-12 shrink-0 rounded-lg border object-cover"
                    />
                  ) : null}
                  <div className="min-w-0 space-y-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {isAdmin ? (
                        <Link
                          href={`/orgs/${orgId}/places/${place.id}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {place.name}
                        </Link>
                      ) : (
                        place.name
                      )}
                      <Badge variant="secondary">{place.typeName}</Badge>
                    </p>
                    {place.address ? (
                      <p className="text-muted-foreground text-sm">
                        {place.address}
                      </p>
                    ) : null}
                    <p className="text-muted-foreground readout text-xs">
                      {place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}, within{" "}
                      {place.radiusM} m
                    </p>
                  </div>
                </div>
                {isAdmin ? (
                  <PlaceRowActions
                    organizationId={orgId}
                    placeId={place.id}
                    name={place.name}
                    isActive={place.isActive}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {rejected.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-muted-foreground text-sm font-semibold">
            Not accepted
          </h2>
          <ul className="divide-border/70 border-border/70 text-muted-foreground divide-y rounded-lg border text-sm">
            {rejected.map((place) => (
              <li key={place.id} className="px-4 py-2">
                {place.name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {isAdmin && archived.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-muted-foreground text-sm font-semibold">
            Archived
          </h2>
          <ul className="divide-border/70 border-border/70 divide-y rounded-lg border">
            {archived.map((place) => (
              <li
                key={place.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm"
              >
                <span>{place.name}</span>
                <PlaceRowActions
                  organizationId={orgId}
                  placeId={place.id}
                  name={place.name}
                  isActive={place.isActive}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
