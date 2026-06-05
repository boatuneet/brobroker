"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight } from "lucide-react";
import type { AuthFormState } from "@/app/auth/actions";

type AuthAction = (
  state: AuthFormState,
  formData: FormData,
) => Promise<AuthFormState>;

export function AuthForm({
  action,
  submitLabel,
  next,
}: {
  action: AuthAction;
  submitLabel: string;
  next?: string;
}) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(
    action,
    undefined,
  );

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      {next ? <input name="next" type="hidden" value={next} /> : null}

      <Field
        autoComplete="email"
        error={state?.fieldErrors?.email}
        inputMode="email"
        label="Email"
        name="email"
        placeholder="you@brokerage.com"
        type="email"
      />
      <Field
        autoComplete="current-password"
        error={state?.fieldErrors?.password}
        label="Password"
        name="password"
        placeholder="At least 6 characters"
        type="password"
      />

      {state?.error ? (
        <p
          aria-live="polite"
          className="rounded-[12px] bg-[#fdecec] px-4 py-3 text-[13px] leading-6 text-[#b42318]"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <SubmitButton label={submitLabel} />
    </form>
  );
}

function Field({
  autoComplete,
  error,
  inputMode,
  label,
  name,
  placeholder,
  type,
}: {
  autoComplete?: string;
  error?: string;
  inputMode?: "email" | "text";
  label: string;
  name: string;
  placeholder: string;
  type: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="bb-mono-label">{label}</span>
      <input
        aria-invalid={error ? true : undefined}
        autoComplete={autoComplete}
        className={`min-h-11 rounded-[10px] border bg-white px-4 text-[15px] text-[#171719] outline-none placeholder:text-[#A9ABA5] focus:ring-2 ${
          error
            ? "border-[#b42318] focus:border-[#b42318] focus:ring-[#b42318]/15"
            : "border-[#D9DAD4] focus:border-[#003C33] focus:ring-[#003C33]/15"
        }`}
        inputMode={inputMode}
        name={name}
        placeholder={placeholder}
        required
        type={type}
      />
      {error ? (
        <span className="text-[12px] leading-5 text-[#b42318]">{error}</span>
      ) : null}
    </label>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-[#003C33] px-5 text-sm font-medium text-white transition-colors hover:bg-[#0B4A3F] disabled:cursor-not-allowed disabled:bg-[#5F625E]"
      disabled={pending}
      type="submit"
    >
      {pending ? "Working…" : label}
      {!pending ? (
        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
      ) : null}
    </button>
  );
}
