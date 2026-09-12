"use client";

import { useRouter } from "next/navigation";

export function LibrarySwitcher({
  libraries,
  activeId,
}: {
  libraries: { id: string; name: string }[];
  activeId: string;
}) {
  const router = useRouter();

  if (libraries.length <= 1) {
    return <span className="hidden text-sm text-gray-500 sm:inline">{libraries[0]?.name}</span>;
  }

  async function onChange(libraryId: string) {
    await fetch("/api/library/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ libraryId }),
    });
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <select
      value={activeId}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-gray-300 bg-transparent px-2 py-1 text-sm dark:border-gray-700"
    >
      {libraries.map((lib) => (
        <option key={lib.id} value={lib.id}>
          {lib.name}
        </option>
      ))}
    </select>
  );
}
