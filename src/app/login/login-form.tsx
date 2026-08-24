"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { login, type LoginState } from "./actions";

const underline =
  "w-full rounded-none border-0 border-b border-white/20 bg-transparent px-0 py-2.5 text-sm text-[#f4f3ee] outline-none transition placeholder:text-white/25 focus:border-[#d6f62b]";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <div className="grid gap-8 sm:grid-cols-2 sm:gap-6">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@stail.co.in"
            className={underline}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="password"
            className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={underline}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-white/35">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            name="remember"
            defaultChecked
            className="size-3.5 accent-[#d6f62b]"
          />
          Remember me
        </label>
        <span>Forgot? Ask People Ops for a reset</span>
      </div>

      {state.error && <p className="text-sm text-[#f2555a]">{state.error}</p>}

      <div className="flex items-end justify-between gap-6">
        <p className="max-w-xs text-xs leading-relaxed text-white/35">
          New at STAIL?{" "}
          <Link
            href="/register"
            className="text-white/70 underline decoration-white/30 underline-offset-4 transition hover:text-[#d6f62b]"
          >
            Create an account
          </Link>{" "}
          — an admin approves it before you can sign in.
        </p>

        <button
          type="submit"
          disabled={pending}
          className="flex size-24 shrink-0 items-center justify-center rounded-full bg-[#f4f3ee] text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0b0b0a] transition hover:bg-[#d6f62b] disabled:opacity-60"
        >
          {pending ? "…" : "Sign in"}
        </button>
      </div>
    </form>
  );
}
