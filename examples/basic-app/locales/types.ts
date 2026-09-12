/** Eager (server-side) message schema — the typed contract every locale implements. */
export interface Messages {
  home: {
    badge: string;
    titleAccent: string;
    titleRest: string;
    tagline: string;
    serverNotePrefix: string;
  };
  switcher: {
    label: string;
    clientChip: string;
    description: string;
    switchLabel: string;
    switchTo: string;
  };
  counterCard: {
    kicker: string;
    dynamicChip: string;
    hint: string;
    loading: string;
  };
  themeToggle: {
    label: string;
  };
  footer: {
    line: string;
  };
}

/** Lazy namespace schema: pluralization and interpolation as typed functions. */
export interface CounterLabels {
  heading: string;
  hint: string;
  increment: string;
  reset: string;
  countLabel: (count: number) => string;
}
