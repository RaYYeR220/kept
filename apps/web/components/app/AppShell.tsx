"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Mark, Texture } from "@/components/Mark";
import { db, getSettings } from "@/lib/client/db";

const TABS = [
  { href: "/app", label: "Home" },
  { href: "/app/hair", label: "Hair" },
  { href: "/app/brows", label: "Brows" },
  { href: "/app/ask", label: "Ask" },
  { href: "/app/share", label: "Share" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const settings = useLiveQuery(getSettings, []);
  const hasLikeness = useLiveQuery(async () => Boolean(await db.likeness.get("current")), [], false);
  const demo = settings?.mode === "replay";

  return (
    <>
      <Texture />
      <div className="relative z-[5] mx-auto min-h-[100dvh] max-w-[440px] px-[18px] pb-32">
        <div className="flex h-[58px] items-center justify-between">
          <Mark href="/" />
          <div className="flex items-center gap-3">
            {settings?.consentAt && (
              <span className="rounded-chip border border-[var(--line)] px-2.5 py-1 text-[12px] font-medium text-[var(--ink-2)]">
                {demo ? `Demo · ${settings.persona === "marcus" ? "Marcus" : "Anna"}` : "Live"}
              </span>
            )}
            <Link href="/app/privacy" className="text-[14px] font-medium text-[var(--ink-3)]">
              Delete everything
            </Link>
          </div>
        </div>
        {children}
      </div>
      {hasLikeness && (
        <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-oat-100 from-60% to-transparent px-[18px] pb-5 pt-6">
          <ul className="mx-auto flex max-w-[404px] justify-between rounded-chip border border-[var(--line)] bg-oat-50/90 p-1.5 backdrop-blur-md">
            {TABS.map((t) => {
              const on = t.href === "/app" ? path === "/app" : path.startsWith(t.href);
              return (
                <li key={t.href}>
                  <Link
                    href={t.href}
                    aria-current={on ? "page" : undefined}
                    className={`flex h-11 items-center rounded-chip px-4 text-[15px] font-semibold ${on ? "bg-oat-900 text-oat-50" : "text-[var(--ink-2)]"}`}
                  >
                    {t.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </>
  );
}
