/** Where a measured value came from. Every number Kept shows carries one. */
export type Provenance = {
  /** YouCam feature that produced the value, e.g. "skin-tone-analysis". */
  api: string;
  version: string;
  taskId: string | null;
  units: number;
  /** ISO timestamp of the measurement. */
  at: string;
  /** "replay" values come from recorded API responses (demo personas). */
  source: "live" | "replay";
};

export type Measured<T> = { value: T; prov: Provenance };
