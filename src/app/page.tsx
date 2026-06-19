import { ScanFlow } from "@/components/scan/ScanFlow";
import { CLINIC } from "@/lib/clinic";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="px-5 pt-6 sm:px-8">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          {CLINIC.name}
        </p>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
        <ScanFlow />
      </main>
    </div>
  );
}
