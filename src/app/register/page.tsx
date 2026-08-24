import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogoDark } from "@/components/shell/brand";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Register" };

export default function RegisterPage() {
  return (
    <div className="flex min-h-dvh bg-[#0b0b0a] text-[#f4f3ee]">
      {/* Left: brand panel */}
      <div className="relative hidden flex-1 overflow-hidden border-r border-white/10 lg:block">
        <div className="absolute left-8 top-8 z-10">
          <BrandLogoDark />
        </div>
        <div className="absolute inset-0">
          <div className="absolute left-1/3 top-0 h-full w-px bg-white/[0.06]" />
          <div className="absolute left-2/3 top-0 h-full w-px bg-white/[0.06]" />
          <div className="absolute left-0 top-1/3 h-px w-full bg-white/[0.06]" />
          <div className="absolute left-0 top-2/3 h-px w-full bg-white/[0.06]" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 64 64" className="size-32 text-[#d6f62b]" aria-hidden>
            <path
              d="M32 2 C35.4 19.4 44.6 28.6 62 32 C44.6 35.4 35.4 44.6 32 62 C28.6 44.6 19.4 35.4 2 32 C19.4 28.6 28.6 19.4 32 2 Z"
              fill="currentColor"
            />
          </svg>
        </div>
        <p className="absolute bottom-8 left-8 text-[11px] text-white/25">
          © {new Date().getFullYear()} ShivTrinetrix AI Labs Pvt. Ltd.
        </p>
      </div>

      {/* Right: form */}
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-[560px] lg:shrink-0 xl:w-[620px]">
        <div className="mb-4 lg:hidden">
          <BrandLogoDark className="h-5" />
        </div>
        <div className="mb-10 flex items-center justify-between">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/30">
            Internal workspace
          </p>
          <Link
            href="/login"
            className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/40 transition hover:text-[#d6f62b]"
          >
            Log in instead
          </Link>
        </div>
        <h1 className="mb-10 text-5xl font-medium tracking-tight">Register</h1>
        <RegisterForm />
        <p className="mt-12 text-[11px] leading-relaxed text-white/25">
          STAIL Workforce OS — attendance, daily reporting and workforce
          intelligence. Access is limited to STAIL employees and interns.
        </p>
      </div>
    </div>
  );
}
