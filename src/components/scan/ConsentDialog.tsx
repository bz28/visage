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
        <h2 className="text-lg font-semibold">Want us to look more closely?</h2>
        <p className="mt-3 text-sm text-neutral-600">
          So far everything stayed on your device. To pick up the finer details
          a quick look can&apos;t catch, we&apos;ll securely send your photo for
          a closer read — used only to create your result, nothing else.
        </p>
        <p className="mt-2 text-xs text-neutral-400">
          Still just a guide, not medical advice.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            onClick={onAccept}
            className="rounded-full bg-foreground px-6 py-2.5 font-medium text-background"
          >
            Yes, take a closer look
          </button>
          <button
            onClick={onDecline}
            className="rounded-full border border-neutral-300 px-6 py-2.5 font-medium"
          >
            Keep it on my device
          </button>
        </div>
      </div>
    </div>
  );
}
