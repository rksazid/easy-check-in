import { BrandMark } from "@/components/brand";
import { requireSession } from "@/lib/session";

export default async function CheckInPage() {
  const session = await requireSession();

  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <BrandMark className="text-muted-foreground/60 size-16" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          You&rsquo;re signed in, {session.user.name.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground mx-auto max-w-sm text-sm">
          Checking in needs a place to check in to. Joining an organization and
          picking a place come next.
        </p>
      </div>
    </div>
  );
}
