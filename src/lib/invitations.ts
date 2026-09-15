import { and, eq, gt, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { invitation, organization, user } from "@/lib/db/schema";

export type PendingInvitation = {
  id: string;
  organizationId: string;
  organizationName: string;
  role: string | null;
  invitedByName: string | null;
  expiresAt: Date;
};

/**
 * Invitations waiting for the signed-in person.
 *
 * Read straight from the table rather than through the organization plugin's
 * list endpoint, which refuses outright unless the account has a verified email
 * address. This app has no email provider, so no account ever will, and that
 * endpoint would hide every invitation forever.
 */
export async function listMyInvitations(
  email: string,
): Promise<PendingInvitation[]> {
  const inviter = sql<string | null>`${user.name}`;

  return db
    .select({
      id: invitation.id,
      organizationId: invitation.organizationId,
      organizationName: organization.name,
      role: invitation.role,
      invitedByName: inviter,
      expiresAt: invitation.expiresAt,
    })
    .from(invitation)
    .innerJoin(organization, eq(invitation.organizationId, organization.id))
    .leftJoin(user, eq(invitation.inviterId, user.id))
    .where(
      and(
        // Addresses are compared lowercased because sign-up does not normalise
        // what the inviter typed.
        sql`lower(${invitation.email}) = lower(${email})`,
        eq(invitation.status, "pending"),
        gt(invitation.expiresAt, new Date()),
      ),
    )
    .orderBy(invitation.expiresAt);
}
