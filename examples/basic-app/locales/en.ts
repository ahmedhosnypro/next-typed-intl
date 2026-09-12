import type { Messages } from "./types";

export const enMessages: Messages = {
  home: {
    badge: "Server Component",
    titleAccent: "Type-safe i18n",
    titleRest: "for Next.js",
    tagline: "Type-safe keys, function pluralization, no ICU, no codegen.",
    serverNotePrefix: "rendered by a Server Component using",
  },
  switcher: {
    label: "Language",
    clientChip: "Client Navigation",
    description: "Switch the active locale to inspect localized route transitions and RTL layout support.",
    switchLabel: "switch language",
    switchTo: "العربية",
  },
  counterCard: {
    kicker: "Lazy namespace: counter",
    dynamicChip: "Dynamic Chunk",
    hint: "Loaded on demand by the client bundle via a dynamic import.",
    loading: "Loading counter…",
  },
  themeToggle: {
    label: "Theme",
  },
  footer: {
    line: "next-typed-intl · typed i18n example",
  },
};
