import Link from "next/link";
import { redirect } from "next/navigation";

import { SignInForm } from "./sign-in-form";
import { getSession } from "@/lib/session";

export const metadata = { title: "Sign in · Easy Check-In" };

export default async function SignInPage() {
  if (await getSession()) redirect("/");

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground text-sm">
          Sign in to check in at your gym or office.
        </p>
      </div>

      <SignInForm />

      <p className="text-muted-foreground text-sm">
        No account yet?{" "}
        <Link
          href="/sign-up"
          className="text-foreground font-medium underline underline-offset-4"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
