"use client";

import { useEffect, useRef, useState } from "react";

export function BarcodeCameraScanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let controls: { stop: () => void } | undefined;
    let cancelled = false;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const { DecodeHintType, BarcodeFormat } = await import("@zxing/library");

        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
        ]);

        const reader = new BrowserMultiFormatReader(hints);
        if (cancelled || !videoRef.current) return;

        controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
          if (result) {
            onDetected(result.getText());
          }
        });
      } catch {
        if (!cancelled) setError("Couldn't access the camera. Check permissions and try again.");
      }
    })();

    return () => {
      cancelled = true;
      controls?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/90 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-lg bg-black">
        <video ref={videoRef} className="w-full" muted playsInline />
      </div>
      {error ? (
        <p className="max-w-sm text-center text-sm text-red-300">{error}</p>
      ) : (
        <p className="text-sm text-gray-300">Point the camera at the book&apos;s barcode.</p>
      )}
      <button
        onClick={onClose}
        className="rounded-lg bg-white px-4 py-2 font-medium text-gray-900"
      >
        Cancel
      </button>
    </div>
  );
}
