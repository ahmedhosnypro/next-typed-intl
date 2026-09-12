"use client";

import { type ReactElement, type ReactNode, Suspense } from "react";

export interface TranslationBoundaryProps {
  /** Translated UI that may suspend while a namespace chunk loads. */
  readonly children: ReactNode;
  /** Rendered while any child below is suspended; defaults to nothing. */
  readonly fallback?: ReactNode;
}

/**
 * Suspense boundary for lazy namespaces. `useTranslation` suspends until the
 * namespace chunk for the active locale has loaded; wrap translated UI in
 * this boundary to control the fallback.
 *
 * Being a Client Component does not restrict it to client files: it is
 * renderable from Server Components too (a Client Component element crosses
 * the RSC boundary, taking `children` and `fallback` along as props), so it
 * is the intended wrapper anywhere in the tree. A plain <Suspense> remains
 * an option when you want to wire the boundary yourself.
 */
export function TranslationBoundary({ children, fallback = null }: TranslationBoundaryProps): ReactElement {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}
