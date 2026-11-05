"use client";

import Link from "next/link";

// Stroked icons drawn on a 24 x 24 grid, matching NitroLog and AstroFit.
const ICONS: Record<string, string> = {
  folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  shield: "M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z",
  user: "M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM4 21a8 8 0 0 1 16 0",
};

export type Tab = { label: string; icon: string; href?: string; active?: boolean; onClick?: () => void };

/** The bar along the bottom of the screen on phones. Hidden on larger screens by the stylesheet. */
export default function TabBar({ tabs }: { tabs: Tab[] }) {
  return (
    <nav className="tabbar" aria-label="Main" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
      {tabs.map(t => {
        const inner = (
          <>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={ICONS[t.icon]} />
            </svg>
            <span>{t.label}</span>
          </>
        );
        const cls = `tabbar-item${t.active ? " active" : ""}`;
        return t.href
          ? <Link key={t.label} href={t.href} className={cls} aria-current={t.active ? "page" : undefined}>{inner}</Link>
          : <button key={t.label} type="button" className={cls} onClick={t.onClick}>{inner}</button>;
      })}
    </nav>
  );
}
