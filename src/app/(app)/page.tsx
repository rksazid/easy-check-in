import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { CheckInPanel } from "./check-in-panel";
import { getActiveCheckIn, sweepForgottenCheckIns } from "@/actions/check-in";
import { Elapsed } from "@/components/elapsed";
import { InstallHint } from "@/components/install-hint";
import { LocalTime } from "@/components/local-time";
import { hasLocationConsent } from "@/lib/consent";
import { listMyOrganizations } from "@/lib/org";
import { requireSession } from "@/lib/session";
import { listMyVisits } from "@/lib/visits";

export const metadata = { title: "Check in" };

export default async function CheckInPage() {
  const session = await requireSession();

  // Sequenced deliberately: the sweep closes forgotten visits, and running it
  // alongside the queries would let them read a visit it is about to close.
  await sweepForgottenCheckIns();

  const [active, memberships, visits, consented] = await Promise.all([
    getActiveCheckIn(),
    listMyOrganizations(session.user.id),
    listMyVisits(3),
    hasLocationConsent(),
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
    <div className="space-y-10">
      <CheckInPanel active={active} consented={consented} />

      <InstallHint />

      {past.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Recent visits</h2>
            <Link
              href="/activity"
              className="text-muted-foreground text-sm underline-offset-4 hover:underline"
            >
              See all
            </Link>
          </div>
          <ul className="divide-border/70 border-border/70 divide-y rounded-lg border">
            {past.map((visit) => (
              <li key={visit.id}>
                <Link
                  href={`/visits/${visit.id}`}
                  className="hover:bg-accent/50 flex min-h-14 items-center gap-3 px-4 py-3 transition-colors"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {visit.placeName}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      <LocalTime value={visit.checkedInAt} />
                    </span>
                  </span>
                  <span className="text-muted-foreground shrink-0 text-sm">
                    <Elapsed
                      since={visit.checkedInAt}
                      until={visit.checkedOutAt}
                    />
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="text-muted-foreground size-4 shrink-0"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
