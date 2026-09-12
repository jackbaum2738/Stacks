import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-20 text-center">
      <div className="max-w-xl space-y-4">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Stacks</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Track a home library of physical books: scan them in and out by ISBN,
          organize them onto shelves, and reserve copies for the people
          they&apos;re headed to.
        </p>
      </div>
      <div className="flex gap-4">
        <Link
          href="/register"
          className="rounded-lg bg-gray-900 px-6 py-3 font-medium text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-gray-300 px-6 py-3 font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
