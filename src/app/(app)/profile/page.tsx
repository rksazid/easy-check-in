import { AvatarSection } from "./avatar-section";
import { ProfileForm } from "./profile-form";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Your profile · Easy Check-In" };

export default async function ProfilePage() {
  const session = await requireSession();
  const { user } = session;

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

      <hr className="border-border/70" />

      <ProfileForm
        name={user.name}
        username={user.username ?? ""}
        email={user.email}
      />
    </div>
  );
}
