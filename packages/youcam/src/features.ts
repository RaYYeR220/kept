// Registry of the YouCam AI features Kept uses. Unit estimates follow the published
// pricing table; the client prefers live numbers from GET /s2s/v2.0/credit/feature-cost.

export type FeatureKey =
  | "skinTone"
  | "faceAttr"
  | "hairType"
  | "hairLength"
  | "hairDensity"
  | "hairFrizz"
  | "fitzpatrick"
  | "skinAnalysis"
  | "hairTransfer"
  | "makeupVto"
  | "hat"
  | "nailVto"
  | "textToImage"
  | "facePre";

export type FeatureSpec = {
  /** Slug used in provenance and in the task path. */
  api: string;
  version: "v2.0" | "v2.1";
  estimateUnits: (body: Record<string, unknown>) => number;
};

const tier = (n: number, steps: Array<[max: number, units: number]>) =>
  steps.find(([max]) => n <= max)?.[1] ?? steps.at(-1)![1];

export const FEATURES: Record<FeatureKey, FeatureSpec> = {
  skinTone: { api: "skin-tone-analysis", version: "v2.0", estimateUnits: () => 20 },
  faceAttr: {
    api: "face-attr-analysis",
    version: "v2.0",
    estimateUnits: (b) => tier((b.features as unknown[] | undefined)?.length ?? 1, [[5, 10], [14, 20], [28, 30]]),
  },
  hairType: { api: "hair-type-detection", version: "v2.0", estimateUnits: () => 2 },
  hairLength: { api: "hair-length-detection", version: "v2.0", estimateUnits: () => 2 },
  hairDensity: { api: "hair-density-detection", version: "v2.0", estimateUnits: () => 1 },
  hairFrizz: { api: "hair-frizziness-detection", version: "v2.0", estimateUnits: () => 2 },
  fitzpatrick: { api: "fitzpatrick-scale-analyzer", version: "v2.0", estimateUnits: () => 10 },
  skinAnalysis: {
    api: "skin-analysis",
    version: "v2.1",
    estimateUnits: (b) => {
      const actions = (b.dst_actions as string[] | undefined) ?? [];
      const hd = actions.some((a) => a.startsWith("hd_"));
      return tier(actions.length, hd ? [[4, 12], [8, 16], [12, 20], [16, 22]] : [[4, 9], [8, 12], [12, 14], [16, 16]]);
    },
  },
  hairTransfer: { api: "hair-transfer", version: "v2.1", estimateUnits: () => 2 },
  makeupVto: { api: "makeup-vto", version: "v2.0", estimateUnits: () => 1 },
  hat: { api: "hat", version: "v2.0", estimateUnits: () => 2 },
  nailVto: { api: "nail-vto", version: "v2.0", estimateUnits: () => 1 },
  textToImage: { api: "text-to-image/youcam", version: "v2.0", estimateUnits: () => 1 },
  // Free pre-processing step that returns face bounding boxes; Kept uses it to crop to the face.
  facePre: { api: "fitzpatrick-scale-analyzer/pre-process", version: "v2.0", estimateUnits: () => 0 },
};

export const taskPath = (key: FeatureKey) => `/s2s/${FEATURES[key].version}/task/${FEATURES[key].api}`;
