import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PlaceForm } from "../place-form";
import { listPlaceTypes } from "@/actions/places";
import { db } from "@/lib/db/client";
import { places } from "@/lib/db/schema";
import { requireOrgAdmin } from "@/lib/org";

export default async function EditPlacePage({
  params,
}: PageProps<"/admin/[orgId]/places/[placeId]">) {
  const { orgId, placeId } = await params;
  await requireOrgAdmin(orgId);

  const [place] = await db
    .select()
    .from(places)
    .where(and(eq(places.id, placeId), eq(places.organizationId, orgId)))
    .limit(1);

  if (!place) notFound();

  const placeTypes = await listPlaceTypes();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href={`/admin/${orgId}/places`}
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          Back to places
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{place.name}</h1>
      </div>

      <PlaceForm
        organizationId={orgId}
        placeTypes={placeTypes}
        initial={{
          id: place.id,
          name: place.name,
          placeTypeId: place.placeTypeId,
          latitude: place.latitude,
          longitude: place.longitude,
          radiusM: place.radiusM,
          address: place.address,
        }}
      />
    </div>
  );
}
