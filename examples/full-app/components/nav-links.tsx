"use client";

import { usePathname } from "@/lib/navigation";

/**
 * Header nav pill: highlights the active route via aria-current. Labels come
 * in as props from the server layout — the eager message map never enters the
 * client bundle.
 */
export function NavLinks({ links }: { links: readonly { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <nav className="nav-links" aria-label="Main">
      {links.map((link) => {
        const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <a key={link.href} href={link.href} className="nav-link" aria-current={active ? "page" : undefined}>
            {link.label}
          </a>
        );
      })}
    </nav>
  );
}
