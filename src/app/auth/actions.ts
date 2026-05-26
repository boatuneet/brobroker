"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const NOT_CONFIGURED_MESSAGE =
  "Authentication is not configured yet. Paste your project URL and publishable key into .env.local, then restart the dev server.";

export type AuthFormState =
  | { error?: string; fieldErrors?: { email?: string; password?: string } }
  | undefined;

function validateCredentials(
  email: string | null,
  password: string | null,
): AuthFormState | null {
  const fieldErrors: { email?: string; password?: string } = {};

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = "Enter a valid email address.";
  }
  if (!password || password.length < 6) {
    fieldErrors.password = "Password must be at least 6 characters.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }
  return null;
}

function getSafeNext(value?: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

async function getRequestOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  const headerStore = await headers();
  const forwardedHost = headerStore.get("x-forwarded-host");
  const host = forwardedHost ?? headerStore.get("host");
  const forwardedProto = headerStore.get("x-forwarded-proto");
  const protocol = forwardedProto ?? (host?.startsWith("localhost") ? "http" : "https");

  if (host) return `${protocol}://${host}`;
  return "http://localhost:3000";
}

export async function login(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED_MESSAGE };

  const email = formData.get("email")?.toString().trim() ?? null;
  const password = formData.get("password")?.toString() ?? null;
  const next = getSafeNext(formData.get("next")?.toString());

  const validation = validateCredentials(email, password);
  if (validation) return validation;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email!,
    password: password!,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signup(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED_MESSAGE };

  const email = formData.get("email")?.toString().trim() ?? null;
  const password = formData.get("password")?.toString() ?? null;
  const next = getSafeNext(formData.get("next")?.toString());

  const validation = validateCredentials(email, password);
  if (validation) return validation;

  const supabase = await createClient();
  const origin = await getRequestOrigin();
  const { error } = await supabase.auth.signUp({
    email: email!,
    password: password!,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/login");
}
