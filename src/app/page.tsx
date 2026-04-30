import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Narrative Consistency Checker",
  description:
    "Paste a story and see what breaks with graph-based narrative consistency checks.",
};

export default function LandingPage() {
  return (
    <main className="h-screen max-h-screen overflow-hidden bg-[var(--ub-bg)] text-[var(--ub-text)]">
      <div className="flex h-full w-full flex-col px-0 pt-0">
        <header className="mb-0 flex items-center justify-between rounded-none border-y border-[var(--ub-border)] bg-[var(--ub-surface)] px-4 py-2 sm:px-5">
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 20 20" aria-hidden="true" className="h-[18px] w-[18px] text-[var(--ub-accent)]">
              <circle cx="4" cy="4" r="2" fill="currentColor" />
              <circle cx="16" cy="4" r="2" fill="currentColor" />
              <circle cx="4" cy="16" r="2" fill="currentColor" />
              <circle cx="16" cy="16" r="2" fill="currentColor" />
              <path d="M6 5.5h8M5.5 6l8.5 8M6 14.5h8" stroke="currentColor" strokeWidth="1.2" fill="none" />
            </svg>
            <div className="leading-tight">
              <p className="text-[15px] font-medium">Narrative</p>
              <p className="text-[15px] font-medium">Consistency Checker</p>
            </div>
          </div>
          <Link
            href="/app"
            className="inline-flex h-8 items-center justify-center rounded-md border border-[var(--ub-accent)]/80 bg-[var(--ub-accent)] px-4 text-xs font-medium text-white shadow-[0_0_0_1px_rgba(79,140,255,0.45)_inset]"
          >
            Try for Free
          </Link>
        </header>

        <section className="flex min-h-0 flex-1 flex-col rounded-none border-y border-[var(--ub-border)] bg-[var(--ub-surface)] px-3 pb-4 pt-6 shadow-[0_18px_55px_rgba(0,0,0,0.45)] sm:px-5 sm:pb-5">
          <h1 className="text-center text-[34px] leading-[1.08] font-medium tracking-[-0.02em] sm:text-[44px]">
            <span className="block text-[var(--ub-text)]">Paste a story.</span>
            <span className="block text-[var(--ub-accent)]">See what breaks.</span>
          </h1>

          <div className="mt-5 min-h-0 flex-1 overflow-hidden rounded-xl bg-[var(--ub-surface-elevated)]">
            <Image
              src="/landing-graph-design-v3.png"
              alt="Narrative consistency graph demo showing event links and highlighted issues"
              width={1024}
              height={596}
              priority
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 95vw, 1024px"
              className="mx-auto h-full w-full object-contain"
            />
          </div>

          <div className="mt-5 shrink-0 text-center">
            <Link
              href="/app"
              className="inline-flex h-11 min-w-[250px] items-center justify-center rounded-[10px] border border-[var(--ub-accent)]/80 bg-[var(--ub-accent)] px-7 text-base font-medium text-white shadow-[0_0_0_1px_rgba(79,140,255,0.5)_inset]"
            >
              Try for Free
            </Link>
            <p className="mt-2 text-xs text-[var(--ub-text-muted)]">No credit card required.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
