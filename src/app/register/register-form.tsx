"use client";

import Link from "next/link";
import { useActionState } from "react";
import { register, type RegisterState } from "./actions";

const underline =
  "w-full rounded-none border-0 border-b border-white/20 bg-transparent px-0 py-2.5 text-sm text-[#f4f3ee] outline-none transition placeholder:text-white/25 focus:border-[#d6f62b]";

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function RegisterForm() {
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(
    register,
    {},
  );

  if (state.ok) {
    return (
      <div className="flex flex-col items-start gap-5">
        <span className="flex size-12 items-center justify-center rounded-full bg-[#d6f62b] text-lg text-[#161703]">
          ✓
        </span>
        <div>
          <h2 className="text-2xl font-medium tracking-tight">
            Registration submitted
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/50">
            Your account is awaiting approval. Once an admin approves it and
            assigns your team, you&apos;ll be able to sign in with the email
            and password you just chose.
          </p>
        </div>
        <Link
          href="/login"
          className="rounded-full border border-white/20 px-5 py-2 text-xs font-medium uppercase tracking-[0.18em] text-white/70 transition hover:border-[#d6f62b]/60 hover:text-[#d6f62b]"
        >
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-7">
      <Field id="reg-name" label="Full name">
        <input
          id="reg-name"
          name="name"
          required
          maxLength={120}
          defaultValue={state.values?.name}
          placeholder="Your name"
          className={underline}
        />
      </Field>

      <div className="grid gap-7 sm:grid-cols-2 sm:gap-6">
        <Field id="reg-email" label="Email">
          <input
            id="reg-email"
            name="email"
            type="email"
            required
            defaultValue={state.values?.email}
            placeholder="you@stail.co.in"
            className={underline}
          />
        </Field>
        <Field id="reg-title" label="Role / title (optional)">
          <input
            id="reg-title"
            name="title"
            maxLength={120}
            defaultValue={state.values?.title}
            placeholder="e.g. Frontend Engineer"
            className={underline}
          />
        </Field>
      </div>

      <div className="grid gap-7 sm:grid-cols-2 sm:gap-6">
        <Field id="reg-password" label="Password">
          <input
            id="reg-password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className={underline}
          />
        </Field>
        <Field id="reg-confirm" label="Confirm password">
          <input
            id="reg-confirm"
            name="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Repeat it"
            className={underline}
          />
        </Field>
      </div>

      {state.error && <p className="text-sm text-[#f2555a]">{state.error}</p>}

      <div className="flex items-end justify-between gap-6">
        <p className="max-w-xs text-xs leading-relaxed text-white/35">
          An admin reviews every registration before access is granted.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="flex size-24 shrink-0 items-center justify-center rounded-full bg-[#f4f3ee] text-center text-[10px] font-semibold uppercase leading-tight tracking-[0.22em] text-[#0b0b0a] transition hover:bg-[#d6f62b] disabled:opacity-60"
        >
          {pending ? "…" : "Register"}
        </button>
      </div>
    </form>
  );
}
