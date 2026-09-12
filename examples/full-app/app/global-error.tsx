"use client";

// Root-level error boundary: replaces the root layout when the layout itself
// throws (e.g. getMessages in app/[locale]/layout.tsx), so it is the only error
// file that renders its own <html>/<body>. No locale context is available when
// this renders, so the copy is static and the styles are inlined (globals.css
// is imported by the layout this boundary replaces).
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          minHeight: "100dvh",
          margin: 0,
          display: "grid",
          placeItems: "center",
          background: "#f6f7fb",
          color: "#171a2b",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: "0.9rem",
            maxWidth: "34rem",
            margin: "1rem",
            padding: "2rem",
            border: "1px solid #e3e6f0",
            borderRadius: 18,
            background: "#fff",
            boxShadow: "0 24px 48px -16px rgba(23, 26, 43, 0.22)",
          }}
          role="alert"
        >
          <span
            style={{
              display: "grid",
              placeItems: "center",
              width: "2.75rem",
              height: "2.75rem",
              borderRadius: 12,
              background: "rgba(220, 38, 38, 0.09)",
              fontSize: "1.3rem",
            }}
            aria-hidden="true"
          >
            ⚠️
          </span>
          <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Something went wrong.</h2>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "#565d78", overflowWrap: "anywhere" }}>
            {error.message}
          </p>
          <button
            type="button"
            onClick={retry}
            style={{
              font: "inherit",
              cursor: "pointer",
              marginTop: "0.4rem",
              padding: "0.7rem 1.4rem",
              border: "1px solid #cdd3e4",
              borderRadius: 12,
              background: "transparent",
              fontWeight: 600,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
