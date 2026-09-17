import { redirect } from "next/navigation";

/** Canonical app routes live under /dashboard/* */
export default function LeadsAliasPage() {
  redirect("/dashboard/leads");
}
