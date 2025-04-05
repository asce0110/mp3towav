"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen p-5 text-center">
          <h2 className="text-2xl font-bold mb-4">发生了错误</h2>
          <p className="mb-4">{error.message}</p>
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={() => reset()}
          >
            重试
          </button>
        </div>
      </body>
    </html>
  );
} 