import Link from "next/link";
import { login } from "@/app/auth/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata = {
  title: "Sign in · BroBroker",
  description: "Access your broker workspace.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params?.next;

  return (
    <AuthShell
      description="Use your broker email and password to access the workspace."
      eyebrow="Welcome back"
      footer={
        <>
          New to BroBroker?{" "}
          <Link
            className="font-medium text-[#17171c] underline-offset-4 hover:underline"
            href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
          >
            Create an account
          </Link>
        </>
      }
      title="Sign in"
    >
      <AuthForm action={login} next={next} submitLabel="Sign in" />
    </AuthShell>
  );
}
