import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/session";

export const metadata = { title: "Super admin" };

export default async function SuperAdminPage() {
  await requireSuperAdmin();
  redirect("/admin?tab=organizations");
}
