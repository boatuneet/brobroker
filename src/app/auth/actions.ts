"use server";

import { revalidatePath } from "next/cache";
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

export async function login(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED_MESSAGE };

  const email = formData.get("email")?.toString().trim() ?? null;
  const password = formData.get("password")?.toString() ?? null;
  const next = formData.get("next")?.toString() || "/dashboard";

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
  redirect(next.startsWith("/") ? next : "/dashboard");
}

export async function signup(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED_MESSAGE };

  const email = formData.get("email")?.toString().trim() ?? null;
  const password = formData.get("password")?.toString() ?? null;

  const validation = validateCredentials(email, password);
  if (validation) return validation;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: email!,
    password: password!,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/login");
}
