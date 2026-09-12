import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter, JetBrains_Mono, Noto_Sans_Arabic } from "next/font/google";
import { getRequestLocale } from "next-typed-intl/server";

import { AppI18nProvider } from "@/components/app-i18n-provider";
import { ThemeProvider } from "@/components/theme";
import { i18n, Locale } from "@/lib/i18n";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-noto-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "next-typed-intl — basic example",
  description: "Type-safe i18n for Next.js — typed keys, function pluralization, no ICU, no codegen.",
};

// Runs before paint on every navigation: applies the persisted theme (cookie →
// system preference) so neither mode flashes the wrong colors.
const themeInit = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)/);var t=m?m[1]:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.classList.toggle("dark",t==="dark");}catch(e){}})();`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getRequestLocale(i18n);
  const cookieStore = await cookies();
  const theme: Theme = cookieStore.get(THEME_COOKIE)?.value === "dark" ? "dark" : "light";
  return (
    <html
      lang={locale}
      dir={locale === Locale.Ar ? "rtl" : "ltr"}
      className={`${inter.variable} ${jetbrainsMono.variable} ${notoSansArabic.variable}`}
      // The pre-paint theme script mutates the class list before hydration by
      // design (cookie → system preference); React should not own it.
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <ThemeProvider defaultTheme={theme}>
          <AppI18nProvider locale={locale}>{children}</AppI18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
