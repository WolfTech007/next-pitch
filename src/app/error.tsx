"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-xl font-semibold text-red-400">Something went wrong</h1>
      <p className="mt-2 text-sm text-zinc-400">{error.message}</p>
      {error.stack && (
        <pre className="mt-4 max-h-64 overflow-auto rounded bg-zinc-900 p-3 text-xs text-zinc-500">
          {error.stack}
        </pre>
      )}
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-md bg-amber-500/90 px-3 py-1.5 text-sm font-medium text-black hover:bg-amber-400"
      >
        Try again
      </button>
    </main>
  );
}
