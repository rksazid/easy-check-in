import Link from "next/link";
import { redirect } from "next/navigation";

import { SignUpForm } from "./sign-up-form";
import { getSession } from "@/lib/session";

export const metadata = { title: "Create account" };

export default async function SignUpPage() {
  if (await getSession()) redirect("/");

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Create your account
        </h1>
        <p className="text-muted-foreground text-sm">
          Then ask to join your gym or workplace.
        </p>
      </div>

      <SignUpForm />

      <p className="text-muted-foreground text-sm">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="text-foreground font-medium underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
