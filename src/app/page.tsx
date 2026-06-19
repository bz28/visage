import { ScanFlow } from "@/components/scan/ScanFlow";
import { CLINIC } from "@/lib/clinic";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-full max-w-4xl flex-col gap-10 px-5 py-12 sm:py-20">
      <header className="text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-[var(--accent)]">
          {CLINIC.name}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          See your features the way we do
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-neutral-500">
          Take a quick look and we&apos;ll show you the areas we might explore
          together — and why. Consider it the start of a conversation, best
          continued in person.
        </p>
      </header>

      <ScanFlow />
    </main>
  );
}
