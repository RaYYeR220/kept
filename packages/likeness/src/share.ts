import type { LikenessSummary } from "./schema.ts";

/** A likeness the person chose to share, e.g. with their wig specialist. Measurements only by default. */
export type SharedLikeness = {
  token: string;
  summary: LikenessSummary;
  createdAt: string;
  expiresAt: string;
  revoked: boolean;
  /** True only if the person also shared their "before" photo for salon try-ons. */
  photoShared: boolean;
  label: string | null;
};

export type ShareLookup = { status: "ok"; share: SharedLikeness } | { status: "expired" | "revoked" | "missing" };

export function lookupStatus(share: SharedLikeness | null, now: string): ShareLookup {
  if (!share) return { status: "missing" };
  if (share.revoked) return { status: "revoked" };
  if (Date.parse(share.expiresAt) <= Date.parse(now)) return { status: "expired" };
  return { status: "ok", share };
}

export const SHARE_UNAVAILABLE = "This link has expired or was withdrawn by the person who shared it.";
