"use client";

interface Props {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * The baseline read is on-device. The deeper AI read needs the photo on a
 * server, so we ask once, explicitly — this is the only point a face leaves the
 * device, and only if the user says yes.
 */
export function ConsentDialog({ open, onAccept, onDecline }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Get a deeper read?</h2>
        <p className="mt-3 text-sm text-neutral-600">
          So far everything ran on your device. For a more detailed,
          expert-level read, we&apos;ll send your photo to our AI to analyze
          soft-tissue cues a basic scan can&apos;t see. It&apos;s used only to
          generate your assessment.
        </p>
        <p className="mt-2 text-xs text-neutral-400">
          Still a simulation, not medical advice or a guaranteed result.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            onClick={onAccept}
            className="rounded-full bg-foreground px-6 py-2.5 font-medium text-background"
          >
            Yes, analyze my photo
          </button>
          <button
            onClick={onDecline}
            className="rounded-full border border-neutral-300 px-6 py-2.5 font-medium"
          >
            Keep it on-device
          </button>
        </div>
      </div>
    </div>
  );
}
