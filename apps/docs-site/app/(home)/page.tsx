import Link from "next/link";
import { InstallTabs } from "@/components/install-tabs";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <span className="mb-6 rounded-full border border-fd-border px-3 py-1 text-xs font-medium text-fd-muted-foreground">
        v0.1 · open source · MIT
      </span>

      <h1 className="bg-gradient-to-b from-fd-foreground to-fd-muted-foreground bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl">
        Cairn
      </h1>

      <p className="mt-5 max-w-2xl text-lg text-fd-muted-foreground">
        The workflow engine for onboarding, product adoption, and user guidance.
        State-machine driven, branching, multi-page — <strong className="text-fd-foreground">not</strong> another tooltip library.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/docs"
          className="rounded-lg bg-fd-primary px-5 py-2.5 font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
        >
          Get Started
        </Link>
        <Link
          href="/docs/quickstart"
          className="rounded-lg border border-fd-border px-5 py-2.5 font-medium text-fd-foreground transition-colors hover:bg-fd-accent"
        >
          Quickstart
        </Link>
      </div>

      <div className="mt-12 w-full max-w-md text-left">
        <InstallTabs />
      </div>

      <p className="mt-16 text-sm text-fd-muted-foreground">
        Framework-agnostic core · React bindings · headless accessible UI
      </p>
    </main>
  );
}
