import { asc, desc, eq } from "drizzle-orm";
import Link from "next/link";

import { PlaceRowActions } from "./place-row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db/client";
import { places, placeTypes } from "@/lib/db/schema";
import { requireOrgAdmin } from "@/lib/org";

export async function generateMetadata({
  params,
}: PageProps<"/admin/[orgId]/places">) {
  const { orgId } = await params;
  const { organization } = await requireOrgAdmin(orgId);
  return { title: `Places · ${organization.name}` };
}

export default async function PlacesPage({
  params,
}: PageProps<"/admin/[orgId]/places">) {
  const { orgId } = await params;
  const { organization } = await requireOrgAdmin(orgId);

  const rows = await db
    .select({
      id: places.id,
      name: places.name,
      address: places.address,
      latitude: places.latitude,
      longitude: places.longitude,
      radiusM: places.radiusM,
      isActive: places.isActive,
      typeName: placeTypes.name,
    })
    .from(places)
    .innerJoin(placeTypes, eq(places.placeTypeId, placeTypes.id))
    .where(eq(places.organizationId, orgId))
    .orderBy(desc(places.isActive), asc(places.name));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Places</h1>
          <p className="text-muted-foreground text-sm">
            Where people can check in for {organization.name}.
          </p>
        </div>
        <Button asChild>
          <Link href={`/admin/${orgId}/places/new`}>Add a place</Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground border-border/70 rounded-lg border border-dashed px-4 py-10 text-center text-sm">
          No places yet. Add one so your members have somewhere to check in.
        </p>
      ) : (
        <ul className="divide-border/70 border-border/70 divide-y rounded-lg border">
          {rows.map((place) => (
            <li
              key={place.id}
              className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 space-y-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  <Link
                    href={`/admin/${orgId}/places/${place.id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {place.name}
                  </Link>
                  <Badge variant="secondary">{place.typeName}</Badge>
                  {place.isActive ? null : (
                    <Badge variant="outline">Archived</Badge>
                  )}
                </p>
                {place.address ? (
                  <p className="text-muted-foreground text-sm">
                    {place.address}
                  </p>
                ) : null}
                <p className="text-muted-foreground readout text-xs">
                  {place.latitude.toFixed(5)}, {place.longitude.toFixed(5)} ·{" "}
                  {place.radiusM} m
                </p>
              </div>
              <PlaceRowActions
                organizationId={orgId}
                placeId={place.id}
                name={place.name}
                isActive={place.isActive}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
