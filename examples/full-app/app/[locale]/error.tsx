"use client";

// Segment error boundary (must be a Client Component). It renders INSIDE the
// [locale] root layout, so it must not declare its own <html>/<body> — only
// app/global-error.tsx (which replaces the root layout) may do that.
// A failed namespace chunk surfaces as a thrown error (the suspense cache
// retains the failure), which bubbles up to this boundary. retry() re-renders
// the segment; pairing it with i18nClient.retryNamespace drops the recorded
// failure so the re-render starts a fresh load instead of replaying the
// same error.
import { i18nClient, nsClient } from "@/lib/i18n.client";

export default function LocaleError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="content">
      <div className="error-panel" role="alert">
        <span className="error-icon" aria-hidden="true">
          ⚠️
        </span>
        <h2>Something went wrong.</h2>
        <p className="error-detail">{error.message}</p>
        <button
          type="button"
          className="btn btn-ghost"
          // Drop the retained failures, then re-render: the namespace chunks
          // load fresh instead of re-throwing the same recorded errors.
          onClick={() => {
            for (const locale of i18nClient.locales) {
              i18nClient.retryNamespace(nsClient.shop, locale);
              i18nClient.retryNamespace(nsClient.cart, locale);
            }
            retry();
          }}
        >
          Try again
        </button>
      </div>
    </main>
  );
}
