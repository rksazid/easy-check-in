"use server";

import { and, eq, ilike, ne, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  invitation,
  joinRequests,
  member,
  organization,
  organizationSettings,
  user as userTable,
} from "@/lib/db/schema";
import { requireOrgAdmin } from "@/lib/org";
import { requireSession, requireSuperAdmin } from "@/lib/session";
import { notifyJoinRequest } from "@/lib/slack/notify";
import { appUrl } from "@/lib/env";

export type ActionResult = { ok: true } | { ok: false; error: string };

function failure(error: unknown, fallback: string): ActionResult {
  return {
    ok: false,
    error: error instanceof Error ? error.message : fallback,
  };
}

/* -------------------------------------------------------------------------- */
/* Super admin                                                                 */
/* -------------------------------------------------------------------------- */

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Give the organization a name.").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Slugs are at least 2 characters.")
    .max(40)
    .regex(slugPattern, "Use lowercase letters, numbers and dashes."),
  logo: z.string().trim().max(100).optional().default("building-2"),
  timezone: z
    .string()
    .trim()
    .min(1)
    .default("UTC")
    .refine((val) => Intl.supportedValuesOf("timeZone").includes(val), {
      message: "Please select a valid time zone from the list.",
    }),
});

export async function createOrganization(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireSuperAdmin();

  const parsed = createOrganizationSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    logo: formData.get("logo") || "building-2",
    timezone: formData.get("timezone") || "UTC",
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  try {
    const created = await auth.api.createOrganization({
      body: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        logo: parsed.data.logo,
      },
      headers: await headers(),
    });

    if (created) {
      if (parsed.data.logo) {
        await db
          .update(organization)
          .set({ logo: parsed.data.logo })
          .where(eq(organization.id, created.id));
      }

      await db
        .insert(organizationSettings)
        .values({
          organizationId: created.id,
          timezone: parsed.data.timezone,
        })
        .onConflictDoNothing();
    }
  } catch (error) {
    return failure(error, "Could not create that organization.");
  }

  revalidatePath("/sa");
  return { ok: true };
}

export async function setOrgLogo(
  organizationId: string,
  logo: string,
): Promise<ActionResult> {
  await requireOrgAdmin(organizationId);

  await db
    .update(organization)
    .set({ logo })
    .where(eq(organization.id, organizationId));

  revalidatePath(`/admin/${organizationId}`);
  revalidatePath(`/orgs/${organizationId}`);
  revalidatePath("/orgs");
  revalidatePath("/sa");
  return { ok: true };
}

/** Grants or revokes org-admin rights, adding the person as a member if needed. */
export async function setOrgAdmin(
  organizationId: string,
  userId: string,
  makeAdmin: boolean,
): Promise<ActionResult> {
  await requireSuperAdmin();

  try {
    const [existing] = await db
      .select({ role: member.role })
      .from(member)
      .where(
        and(
          eq(member.organizationId, organizationId),
          eq(member.userId, userId),
        ),
      )
      .limit(1);

    if (!existing) {
      if (!makeAdmin) return { ok: true };
      await auth.api.addMember({
        body: { userId, organizationId, role: "admin" },
      });
    } else {
      // Never demote the creator; an organization with no owner cannot be fixed
      // from inside the app.
      if (existing.role === "owner") {
        return { ok: false, error: "The owner's role cannot be changed." };
      }
      await db
        .update(member)
        .set({ role: makeAdmin ? "admin" : "member" })
        .where(
          and(
            eq(member.organizationId, organizationId),
            eq(member.userId, userId),
          ),
        );
    }
  } catch (error) {
    return failure(error, "Could not change that person's role.");
  }

  revalidatePath(`/sa/${organizationId}`);
  revalidatePath("/sa");
  return { ok: true };
}

export async function setOrgTimezone(
  organizationId: string,
  timezone: string,
): Promise<ActionResult> {
  await requireOrgAdmin(organizationId);

  if (!Intl.supportedValuesOf("timeZone").includes(timezone)) {
    return { ok: false, error: "That is not a recognised time zone." };
  }

  await db
    .insert(organizationSettings)
    .values({ organizationId, timezone })
    .onConflictDoUpdate({
      target: organizationSettings.organizationId,
      set: { timezone },
    });

  revalidatePath(`/admin/${organizationId}`);
  return { ok: true };
}

export async function setOrgManualCheckIn(
  organizationId: string,
  allowManualCheckIn: boolean,
): Promise<ActionResult> {
  await requireOrgAdmin(organizationId);

  await db
    .insert(organizationSettings)
    .values({ organizationId, allowManualCheckIn })
    .onConflictDoUpdate({
      target: organizationSettings.organizationId,
      set: { allowManualCheckIn },
    });

  revalidatePath(`/admin/${organizationId}`);
  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Joining, from the member's side                                            */
/* -------------------------------------------------------------------------- */

export async function requestToJoin(
  organizationId: string,
  message: string,
): Promise<ActionResult> {
  const session = await requireSession();

  const [alreadyMember] = await db
    .select({ role: member.role })
    .from(member)
    .where(
      and(
        eq(member.organizationId, organizationId),
        eq(member.userId, session.user.id),
      ),
    )
    .limit(1);

  if (alreadyMember) {
    return { ok: false, error: "You are already in this organization." };
  }

  const note = message.trim().slice(0, 280) || null;

  try {
    await db.insert(joinRequests).values({
      organizationId,
      userId: session.user.id,
      message: note,
    });
  } catch {
    // The partial unique index is what rejects a second pending request.
    return { ok: false, error: "You have already asked to join this one." };
  }

  // After the write, and never allowed to fail it.
  await notifyJoinRequest({
    organizationId,
    personName: session.user.name,
    note,
    appUrl: `${appUrl()}/admin/${organizationId}`,
  });

  revalidatePath("/orgs");
  return { ok: true };
}

export async function cancelJoinRequest(
  requestId: string,
): Promise<ActionResult> {
  const session = await requireSession();

  await db
    .delete(joinRequests)
    .where(
      and(
        eq(joinRequests.id, requestId),
        eq(joinRequests.userId, session.user.id),
        eq(joinRequests.status, "pending"),
      ),
    );

  revalidatePath("/orgs");
  return { ok: true };
}

export async function respondToInvitation(
  invitationId: string,
  accept: boolean,
): Promise<ActionResult> {
  const session = await requireSession();

  if (accept) {
    // The plugin guards addMember against duplicates but not acceptInvitation,
    // so someone who both asked to join and was invited could end up with two
    // membership rows. A unique index now makes that impossible; this check is
    // what turns it into a sentence instead of a constraint violation.
    const [invited] = await db
      .select({ organizationId: invitation.organizationId })
      .from(invitation)
      .where(eq(invitation.id, invitationId))
      .limit(1);

    if (invited) {
      const [already] = await db
        .select({ role: member.role })
        .from(member)
        .where(
          and(
            eq(member.organizationId, invited.organizationId),
            eq(member.userId, session.user.id),
          ),
        )
        .limit(1);

      if (already) {
        // Clear the stale invitation so it stops being offered.
        await db
          .update(invitation)
          .set({ status: "accepted" })
          .where(eq(invitation.id, invitationId));

        revalidatePath("/orgs");
        return { ok: true };
      }
    }
  }

  try {
    if (accept) {
      await auth.api.acceptInvitation({
        body: { invitationId },
        headers: await headers(),
      });
    } else {
      await auth.api.rejectInvitation({
        body: { invitationId },
        headers: await headers(),
      });
    }
  } catch (error) {
    return failure(error, "Could not respond to that invitation.");
  }

  revalidatePath("/orgs");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Joining, from the admin's side                                             */
/* -------------------------------------------------------------------------- */

export async function decideJoinRequest(
  requestId: string,
  approve: boolean,
): Promise<ActionResult> {
  const session = await requireSession();

  const [request] = await db
    .select({
      id: joinRequests.id,
      userId: joinRequests.userId,
      organizationId: joinRequests.organizationId,
      status: joinRequests.status,
    })
    .from(joinRequests)
    .where(eq(joinRequests.id, requestId))
    .limit(1);

  if (!request || request.status !== "pending") {
    return { ok: false, error: "That request has already been dealt with." };
  }

  // Authorises against the request's own organization, so a request id from
  // elsewhere cannot be decided by an admin of a different organization.
  await requireOrgAdmin(request.organizationId);

  try {
    if (approve) {
      await auth.api.addMember({
        body: {
          userId: request.userId,
          organizationId: request.organizationId,
          role: "member",
        },
      });
    }

    await db
      .update(joinRequests)
      .set({
        status: approve ? "approved" : "rejected",
        decidedAt: new Date(),
        decidedBy: session.user.id,
      })
      .where(eq(joinRequests.id, requestId));
  } catch (error) {
    return failure(error, "Could not update that request.");
  }

  revalidatePath(`/admin/${request.organizationId}`);
  return { ok: true };
}

/** Finds registered accounts to invite. Requires a real search term. */
export async function searchUsersToInvite(
  organizationId: string,
  term: string,
) {
  await requireOrgAdmin(organizationId);

  const query = term.trim();
  if (query.length < 3) return [];

  const existing = await db
    .select({ userId: member.userId })
    .from(member)
    .where(eq(member.organizationId, organizationId));

  const excluded = existing.map((row) => row.userId);

  return db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      username: userTable.username,
      image: userTable.image,
    })
    .from(userTable)
    .where(
      and(
        ilike(userTable.email, `%${query}%`),
        excluded.length ? notInArray(userTable.id, excluded) : ne(userTable.id, ""),
      ),
    )
    .limit(8);
}

export async function inviteUser(
  organizationId: string,
  email: string,
): Promise<ActionResult> {
  await requireOrgAdmin(organizationId);

  try {
    await auth.api.createInvitation({
      body: { email, role: "member", organizationId },
      headers: await headers(),
    });
  } catch (error) {
    return failure(error, "Could not send that invitation.");
  }

  revalidatePath(`/admin/${organizationId}`);
  return { ok: true };
}

export async function updateMemberRole(
  organizationId: string,
  memberId: string,
  newRole: "admin" | "manager" | "member",
): Promise<ActionResult> {
  const { session, isSuperAdmin, isOwner, isAdmin } =
    await requireOrgAdmin(organizationId);

  if (!isAdmin && !isSuperAdmin) {
    return { ok: false, error: "Only administrators can change member roles." };
  }

  const [targetMember] = await db
    .select({
      id: member.id,
      userId: member.userId,
      role: member.role,
    })
    .from(member)
    .where(
      and(
        eq(member.id, memberId),
        eq(member.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!targetMember) {
    return { ok: false, error: "Member not found in this organization." };
  }

  if (targetMember.role === "owner") {
    return { ok: false, error: "The owner's role cannot be changed." };
  }

  if (targetMember.userId === session.user.id) {
    return { ok: false, error: "You cannot change your own role." };
  }

  if (!isOwner && !isSuperAdmin) {
    if (newRole === "admin") {
      return {
        ok: false,
        error:
          "Only the organization owner or super admin can assign the Admin role.",
      };
    }
    if (targetMember.role === "admin") {
      return {
        ok: false,
        error:
          "Only the organization owner or super admin can change an Administrator's role.",
      };
    }
  }

  try {
    await db
      .update(member)
      .set({ role: newRole })
      .where(
        and(
          eq(member.id, memberId),
          eq(member.organizationId, organizationId),
        ),
      );
  } catch (error) {
    return failure(error, "Could not update member role.");
  }

  revalidatePath(`/admin/${organizationId}`);
  revalidatePath(`/orgs/${organizationId}`);
  return { ok: true };
}

export async function removeMemberFromOrg(
  organizationId: string,
  memberIdOrEmail: string,
): Promise<ActionResult> {
  const { session, isSuperAdmin, isOwner } = await requireOrgAdmin(organizationId);

  // If passed an id, inspect role
  const [target] = await db
    .select({ id: member.id, userId: member.userId, role: member.role })
    .from(member)
    .where(
      and(
        eq(member.id, memberIdOrEmail),
        eq(member.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (target) {
    if (target.role === "owner") {
      return { ok: false, error: "The organization owner cannot be removed." };
    }
    if (target.userId === session.user.id) {
      return { ok: false, error: "You cannot remove yourself from the organization." };
    }
    if (target.role === "admin" && !isOwner && !isSuperAdmin) {
      return { ok: false, error: "Only the owner or a super admin can remove another admin." };
    }
  }

  try {
    await auth.api.removeMember({
      body: { memberIdOrEmail, organizationId },
      headers: await headers(),
    });
  } catch (error) {
    return failure(error, "Could not remove that member.");
  }

  revalidatePath(`/admin/${organizationId}`);
  return { ok: true };
}

export async function setActiveOrganization(
  organizationId: string,
): Promise<ActionResult> {
  await requireSession();

  try {
    await auth.api.setActiveOrganization({
      body: { organizationId },
      headers: await headers(),
    });
  } catch (error) {
    return failure(error, "Could not switch organization.");
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Organizations the signed-in user is neither in nor already waiting on. */
export async function listJoinableOrganizations() {
  const session = await requireSession();

  const mine = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, session.user.id));

  const pending = await db
    .select({ organizationId: joinRequests.organizationId })
    .from(joinRequests)
    .where(
      and(
        eq(joinRequests.userId, session.user.id),
        eq(joinRequests.status, "pending"),
      ),
    );

  const excluded = [
    ...mine.map((row) => row.organizationId),
    ...pending.map((row) => row.organizationId),
  ];

  return db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo,
    })
    .from(organization)
    .where(excluded.length ? notInArray(organization.id, excluded) : undefined)
    .orderBy(organization.name);
}
