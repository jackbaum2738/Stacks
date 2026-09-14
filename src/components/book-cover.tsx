"use client";

import { useState } from "react";

export function BookCover({
  src,
  alt,
  className = "",
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center rounded-none border border-line bg-bg text-lg dark:border-line-strong dark:bg-surface-raised ${className}`}
        aria-hidden
      >
        📖
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- covers are external/unpredictable domains, not worth an Image remotePatterns config
    <img
      src={src}
      alt={alt}
      className={`rounded-none border border-line object-cover dark:border-line-strong ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
