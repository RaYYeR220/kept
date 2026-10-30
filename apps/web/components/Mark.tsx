import Link from "next/link";

export function Mark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="font-display flex items-center gap-2.5 text-[23px] font-semibold leading-none tracking-[-0.03em] text-[var(--ink)]">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M11 2c4 4 4 8 0 11s-4 6 0 7" stroke="#1c1814" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M14 3c3 4 3 7 0 10" stroke="#5b3a29" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      Kept
    </Link>
  );
}

export function Texture() {
  return (
    <>
      <div className="tex-pools" />
      <div className="tex-grid" />
      <div className="tex-grain" />
    </>
  );
}
