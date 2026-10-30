import Link from "next/link";
import { Mark, Texture } from "@/components/Mark";

export const metadata = { title: "Kept — For wig specialists" };

export default function SalonIntro() {
  return (
    <>
      <Texture />
      <div className="relative z-[5] mx-auto max-w-[1080px] px-5 pb-24 sm:px-14">
        <nav className="flex h-[78px] items-center justify-between">
          <Mark />
          <Link href="/proof" className="text-[15px] font-medium">Proof</Link>
        </nav>
        <p className="mt-8 text-[15px] font-medium text-[var(--ink-2)]">For wig specialists</p>
        <h1 className="display mt-4 max-w-[17ch] text-[46px] sm:text-[72px]">Start the fitting from a measured likeness.</h1>
        <p className="mt-6 max-w-[60ch] text-[18px] leading-[1.6] text-[var(--ink-2)]">
          When a client shares their Kept link, you see what YouCam measured before their treatment — hair colour family, curl pattern, density and length, brow colour and shape, skin tone — each value with the API and date it came from. Add pieces from your own stock and Kept ranks them against the likeness. If the client also shared their before photo, you can try your pieces on them.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {[
            ["Open the link", "No account. Links last seven days and the client can withdraw them at any time."],
            ["Add your stock", "Paste a product photo link for each piece. Kept reads its colour family and ranks it."],
            ["Use any assistant", "The same link works over MCP at /api/mcp, so an assistant can read the likeness and match wigs for you."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-card border border-[var(--line)] bg-oat-50/60 p-6">
              <h2 className="font-display text-[24px] font-medium tracking-[-0.025em]">{t}</h2>
              <p className="mt-3 text-[16px] leading-[1.6] text-[var(--ink-2)]">{d}</p>
            </div>
          ))}
        </div>
        <pre className="mt-12 overflow-x-auto rounded-card border border-[var(--line)] bg-oat-900 p-6 text-[13px] leading-[1.6] text-oat-100">
{`# any MCP client
{ "mcpServers": { "kept": { "url": "https://<this-site>/api/mcp" } } }

tools: likeness_summary(share_token) · match_wigs(share_token, max_price_usd?)
       check_product(title, category, ingredients?) · typical_timeline(first_infusion)`}
        </pre>
      </div>
    </>
  );
}
