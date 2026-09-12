import Link from "next/link";

import { PlaceForm } from "../place-form";
import { listPlaceTypes } from "@/actions/places";
import { requireOrgAdmin } from "@/lib/org";

// Central London: a neutral starting view when we have nothing better. The admin
// searches or uses their own location from here.
const DEFAULT_VIEW = { latitude: 51.5072, longitude: -0.1276 };

export default async function NewPlacePage({
  params,
}: PageProps<"/admin/[orgId]/places/new">) {
  const { orgId } = await params;
  const { organization } = await requireOrgAdmin(orgId);
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
        <h1 className="text-2xl font-semibold tracking-tight">Add a place</h1>
        <p className="text-muted-foreground text-sm">
          For {organization.name}.
        </p>
      </div>

      <PlaceForm
        organizationId={orgId}
        placeTypes={placeTypes}
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
