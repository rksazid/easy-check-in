import Link from "next/link";

import { CheckInPanel } from "./check-in-panel";
import {
  getActiveCheckIn,
  listMyRecentVisits,
  sweepForgottenCheckIns,
} from "@/actions/check-in";
import { Elapsed } from "@/components/elapsed";
import { LocalTime } from "@/components/local-time";
import { listMyOrganizations } from "@/lib/org";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Check in · Easy Check-In" };

export default async function CheckInPage() {
  const session = await requireSession();

  // Sequenced deliberately: the sweep closes forgotten visits, and running it
  // alongside the queries would let them read a visit it is about to close.
  await sweepForgottenCheckIns();

  const [active, memberships, visits] = await Promise.all([
    getActiveCheckIn(),
    listMyOrganizations(session.user.id),
    listMyRecentVisits(5),
  ]);

  if (memberships.length === 0) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Join an organization first
        </h1>
        <p className="text-muted-foreground text-sm">
          Checking in needs somewhere to check in to. Ask to join your gym or
          workplace and an admin will let you in.
        </p>
        <Link
          href="/orgs"
          className="text-foreground inline-block font-medium underline underline-offset-4"
        >
          Find an organization
        </Link>
      </div>
    );
  }

  const past = visits.filter((visit) => visit.checkedOutAt);

  return (
    <div className="space-y-12">
      <CheckInPanel active={active} />

      {past.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Recent visits</h2>
          <ul className="divide-border/70 border-border/70 divide-y rounded-lg border">
            {past.map((visit) => (
              <li
                key={visit.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="font-medium">{visit.placeName}</span>
                  <span className="text-muted-foreground ml-2 text-xs">
                    <LocalTime value={visit.checkedInAt} />
                  </span>
                </span>
                <span className="text-muted-foreground text-sm">
                  <Elapsed
                    since={visit.checkedInAt}
                    until={visit.checkedOutAt}
                  />
                  {visit.checkoutReason === "auto_forgot" ? (
                    <span className="ml-2 text-xs">(closed automatically)</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
