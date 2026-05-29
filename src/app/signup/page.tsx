import Link from "next/link";
import { signup } from "@/app/auth/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata = {
  title: "Create account · BroBroker",
  description: "Create your BroBroker workspace account.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params?.next;

  return (
    <AuthShell
      description="Create a workspace account and sign in immediately."
      eyebrow="Get started"
      footer={
        <>
          Already have an account?{" "}
          <Link
            className="font-medium text-[#171719] underline-offset-4 hover:underline"
            href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          >
            Sign in instead
          </Link>
        </>
      }
      title="Create account"
    >
      <AuthForm action={signup} next={next} submitLabel="Create account" />
    </AuthShell>
  );
}
