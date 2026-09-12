import { eq } from "drizzle-orm";
import Link from "next/link";

import { PlaceForm } from "../place-form";
import { listPlaceTypes } from "@/actions/places";
import { db } from "@/lib/db/client";
import { organization } from "@/lib/db/schema";
import { requireMembership } from "@/lib/org";

// Central London: a neutral starting view when we have nothing better. The user
// searches, or uses their own location, from here.
const DEFAULT_VIEW = { latitude: 51.5072, longitude: -0.1276 };

export default async function NewPlacePage({
  params,
}: PageProps<"/orgs/[orgId]/places/new">) {
  const { orgId } = await params;
  const { isAdmin } = await requireMembership(orgId);

  const [org] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1);

  const placeTypes = await listPlaceTypes();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href={`/orgs/${orgId}/places`}
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          Back to places
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Add a place</h1>
        <p className="text-muted-foreground text-sm">
          {isAdmin
            ? `For ${org?.name}.`
            : `An admin of ${org?.name} will check it before anyone can check in here.`}
        </p>
      </div>

      <PlaceForm
        organizationId={orgId}
        placeTypes={placeTypes}
        needsApproval={!isAdmin}
        initial={{
          name: "",
          placeTypeId: null,
          latitude: DEFAULT_VIEW.latitude,
          longitude: DEFAULT_VIEW.longitude,
          radiusM: 150,
          address: null,
        }}
      />
    </div>
  );
}
