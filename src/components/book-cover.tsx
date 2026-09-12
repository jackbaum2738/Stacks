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
        className={`flex items-center justify-center rounded bg-gray-200 text-lg dark:bg-gray-800 ${className}`}
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
      className={`rounded object-cover ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
