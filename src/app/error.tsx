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
      <h1 className="text-xl font-semibold text-np-danger">Something went wrong</h1>
      <p className="mt-2 text-sm text-white/55">{error.message}</p>
      {error.stack && (
        <pre className="mt-4 max-h-64 overflow-auto rounded-np-control border border-white/[0.06] bg-np-panel/80 p-3 text-xs text-white/45">
          {error.stack}
        </pre>
      )}
      <button
        type="button"
        onClick={() => reset()}
        className="np-btn-primary mt-6 px-4 py-2 text-sm"
      >
        Try again
      </button>
    </main>
  );
}
