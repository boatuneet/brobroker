import { redirect } from "next/navigation";

/* Root entry point. The proxy redirects anonymous traffic to /login before
   this even renders; authenticated users land here and are forwarded to
   the dashboard. */
export default function Index() {
  redirect("/dashboard");
}
