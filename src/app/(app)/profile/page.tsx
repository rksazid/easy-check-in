import Link from "next/link";

import { AvatarSection } from "./avatar-section";
import { ProfileForm } from "./profile-form";
import { OrgIcon } from "@/components/org-icon";
import { SignOutButton } from "@/components/sign-out-button";
import { TagBadge } from "@/components/tag-badge";
import { ThemeSelector } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { listMyOrganizations } from "@/lib/org";
import { requireSession } from "@/lib/session";
import { myTagsByOrganization } from "@/lib/tags";

export const metadata = { title: "Your profile" };

export default async function ProfilePage() {
  const session = await requireSession();
  const { user } = session;

  const [memberships, myTags] = await Promise.all([
    listMyOrganizations(user.id),
    myTagsByOrganization(user.id),
  ]);

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Your profile</h1>
        <p className="text-muted-foreground text-sm">
          How you appear to the other people in your organizations.
        </p>
      </div>

      <AvatarSection
        name={user.name}
        email={user.email}
        image={user.image ?? null}
        avatarSource={user.avatarSource ?? "initials"}
      />

      {memberships.length > 0 ? (
        <>
          <hr className="border-border/70" />

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Where you belong</h2>
            <p className="text-muted-foreground text-sm">
              Tags are set by the admins of each organization, and mean nothing
              outside the one that gave them to you.
            </p>
            <ul className="divide-border/70 border-border/70 divide-y rounded-lg border">
              {memberships.map((membership) => {
                const tags = myTags.get(membership.organizationId) ?? [];

                return (
                  <li key={membership.organizationId} className="px-4 py-3">
                    <Link
                      href={`/orgs/${membership.organizationId}`}
                      className="space-y-1"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <OrgIcon logo={membership.logo} name={membership.name} size="sm" />
                        <span className="font-medium underline-offset-4 hover:underline">
                          {membership.name}
                        </span>
                        {membership.isAdmin ? (
                          <Badge variant="secondary">{membership.role}</Badge>
                        ) : null}
                      </span>
                      {tags.length > 0 ? (
                        <span className="flex flex-wrap gap-1">
                          {tags.map((tag) => (
                            <TagBadge key={tag.id} name={tag.name} color={tag.color} />
                          ))}
                        </span>
                      ) : (
                        <span className="text-muted-foreground block text-xs">
                          No tags here yet
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      ) : null}

      <hr className="border-border/70" />

      <ProfileForm
        name={user.name}
        username={user.username ?? ""}
        email={user.email}
      />

      <hr className="border-border/70" />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Appearance</h2>
        <p className="text-muted-foreground text-sm">
          Customize how Easy Check-In looks on your device.
        </p>
        <ThemeSelector />
      </section>

      <hr className="border-border/70" />

      <SignOutButton />
    </div>
  );
}
