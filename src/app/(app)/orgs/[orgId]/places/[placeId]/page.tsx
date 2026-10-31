import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PlaceForm } from "../place-form";
import { listPlaceTypes } from "@/actions/places";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { db } from "@/lib/db/client";
import { organization, places } from "@/lib/db/schema";
import { requireMembership } from "@/lib/org";

export default async function EditPlacePage({
  params,
}: PageProps<"/orgs/[orgId]/places/[placeId]">) {
  const { orgId, placeId } = await params;
  const { session, isAdmin } = await requireMembership(orgId);

  const [[place], [org]] = await Promise.all([
    db
      .select()
      .from(places)
      .where(and(eq(places.id, placeId), eq(places.organizationId, orgId)))
      .limit(1),
    db
      .select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, orgId))
      .limit(1),
  ]);

  if (!place) notFound();

  // A member may still correct their own proposal while it is waiting.
  const ownPendingProposal =
    place.createdBy === session.user.id && place.status === "pending";
  if (!isAdmin && !ownPendingProposal) notFound();

  const placeTypes = await listPlaceTypes();

  return (
    <div className="space-y-6">
      <BreadcrumbNav
        backHref={`/orgs/${orgId}/places`}
        backLabel="Back to places"
        items={[
          { label: "Organizations", href: "/orgs" },
          { label: org?.name ?? "Org", href: `/orgs/${orgId}` },
          { label: "Places", href: `/orgs/${orgId}/places` },
          { label: place.name },
        ]}
      />

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{place.name}</h1>
        {place.status === "pending" ? (
          <p className="text-muted-foreground text-sm">
            Waiting for an admin to approve it.
          </p>
        ) : null}
      </div>

      <PlaceForm
        organizationId={orgId}
        placeTypes={placeTypes}
        needsApproval={false}
        initial={{
          id: place.id,
          name: place.name,
          placeTypeId: place.placeTypeId,
          imageUrl: place.imageUrl,
          latitude: place.latitude,
          longitude: place.longitude,
          radiusM: place.radiusM,
          address: place.address,
        }}
      />
    </div>
  );
}
