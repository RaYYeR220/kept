"use client";

import Dexie, { type EntityTable } from "dexie";
import type { Likeness, TreatmentPlan } from "@kept/likeness";

// Everything about the person stays in this browser: photos, measurements, renders,
// receipts. The server only sees a photo for the seconds it takes to measure it.

export type Mode = "live" | "replay";
export type PhotoSlot = "front" | "right" | "left" | "today";

export type Settings = {
  id: "me";
  consentAt: string | null;
  consentVersion: string;
  mode: Mode;
  persona: "anna" | "marcus";
  plan: TreatmentPlan | null;
};

export type StoredPhoto = { slot: PhotoSlot; blob: Blob; takenAt: string };
export type StoredLikeness = { id: "current"; likeness: Likeness; crossCheck: { browDeltaE: number | null }; taskIds: string[]; units: number };
export type StoredRender = { id: string; kind: "wig" | "brows" | "hat"; blob: Blob; label: string; createdAt: string; meta: Record<string, unknown> };
export type StoredReceipt = { id?: number; at: string; kind: "tool" | "gate" | "measure"; name: string; status: string; detail: string; units?: number };
export type StoredShare = { token: string; expiresAt: string; photoShared: boolean; createdAt: string; revoked: boolean };
export type StoredMessage = { id?: number; role: "user" | "assistant"; content: string; at: string; card?: { title: string; body: string } | null; renders?: string[]; checkouts?: string[] };

export const CONSENT_VERSION = "2026-10-30";

class KeptDb extends Dexie {
  settings!: EntityTable<Settings, "id">;
  photos!: EntityTable<StoredPhoto, "slot">;
  likeness!: EntityTable<StoredLikeness, "id">;
  renders!: EntityTable<StoredRender, "id">;
  receipts!: EntityTable<StoredReceipt, "id">;
  shares!: EntityTable<StoredShare, "token">;
  messages!: EntityTable<StoredMessage, "id">;

  constructor() {
    super("kept");
    this.version(1).stores({
      settings: "id",
      photos: "slot",
      likeness: "id",
      renders: "id, kind, createdAt",
      receipts: "++id, at",
      shares: "token",
      messages: "++id, at",
    });
  }
}

export const db = new KeptDb();

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get("me")) ?? { id: "me", consentAt: null, consentVersion: CONSENT_VERSION, mode: "replay", persona: "anna", plan: null };
}

export async function updateSettings(patch: Partial<Omit<Settings, "id">>) {
  await db.settings.put({ ...(await getSettings()), ...patch });
}

/** Deletes everything Kept has stored in this browser. */
export async function wipeAll() {
  await db.delete();
  await db.open();
}
