import { ScanFlow } from "@/components/scan/ScanFlow";
import { CLINIC } from "@/lib/clinic";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-10 px-5 py-12 sm:py-20">
      <header className="text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-[var(--accent)]">
          {CLINIC.name}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          See what an expert injector would notice
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-neutral-500">
          Scan your face for an educational read on the filler areas worth
          discussing — and why. A simulation to start the conversation, not
          medical advice.
        </p>
      </header>

      <ScanFlow />
    </main>
  );
}
