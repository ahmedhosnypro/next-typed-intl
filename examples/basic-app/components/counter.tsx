"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "next-typed-intl/react";

import { PlusIcon, RotateIcon } from "@/components/icons";
import { counterNamespace } from "@/lib/i18n";

export function Counter() {
  const t = useTranslation(counterNamespace);
  const [count, setCount] = useState(0);
  const firstRender = useRef(true);

  // Bump the number on every change, but not on hydration.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const el = document.querySelector<HTMLElement>(".counter-display");
    if (!el) return;
    el.classList.remove("bump");
    // Force a reflow so the animation restarts on rapid clicks.
    void el.offsetWidth;
    el.classList.add("bump");
  }, [count]);

  return (
    <div className="counter">
      <div className="counter-label">{t.countLabel(count)}</div>
      <div className="counter-display">{count}</div>
      <div className="counter-actions">
        <button type="button" className="btn btn-primary" onClick={() => setCount((c) => c + 1)}>
          <PlusIcon />
          <span>{t.increment}</span>
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setCount(0)}>
          <RotateIcon />
          <span>{t.reset}</span>
        </button>
      </div>
    </div>
  );
}
