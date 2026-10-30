import { handleMcpRequest } from "@kept/mcp";
import { rankWigs } from "@kept/likeness";
import { shares, shop } from "@/lib/server/env";
import { colourWords } from "@/lib/server/wigs";

export const runtime = "nodejs";

async function handle(req: Request) {
  return handleMcpRequest(req, {
    getShare: (t) => shares().raw(t),
    findWigs: async (share, q) => {
      const hair = share.summary.hair;
      const wigs = await shop.searchWigs({ colourWords: colourWords(hair.color?.value.name ?? null), texture: hair.type?.value.term ?? null, medical: q.medical });
      const affordable = q.maxPriceMinor === null ? wigs : wigs.filter((w) => w.priceMinor !== null && w.priceMinor <= q.maxPriceMinor!);
      return hair.color ? rankWigs({ hex: hair.color.value.hex, texture: hair.type?.value.term ?? null, lengthIn: null }, affordable) : rankWigs({ hex: "#000000", texture: null, lengthIn: null }, []);
    },
  });
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
