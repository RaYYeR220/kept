// Maps YouCam Face Analyzer brow measurements onto the YouCam Makeup VTO eyebrow
// pattern catalogue (plugins-media.makeupar.com/wcm-saas/patterns/eyebrows.json).

export type BrowShape = {
  /** Face Analyzer `eyebrow.*_shape`: Hard Angled | Soft Angled | Straight | Rounded | Obscured */
  shape: string;
  /** Face Analyzer `eyebrow.*_body_thickness`: Dense | Sparse | Average | Unknown */
  thickness: string;
};

export type BrowPattern = { category: string; label: string };

export type BrowMatch = {
  name: string;
  curvature: number;
  thickness: number;
  definition: number;
  /** False when the brow shape could not be measured and a neutral default was used. */
  measuredShape: boolean;
};

const SHAPE_TO_CATEGORY: Record<string, string> = {
  "Hard Angled": "High Arch",
  "Soft Angled": "Soft Arch",
  Straight: "Straight",
  Rounded: "Curved",
};

const THICKNESS_OFFSET: Record<string, number> = { Dense: 30, Average: 0, Sparse: -20 };

const labelNumber = (label: string) => Number(label.match(/(\d+)$/)?.[1] ?? Number.MAX_SAFE_INTEGER);

export function matchBrowPattern(measured: BrowShape, patterns: BrowPattern[]): BrowMatch {
  const mapped = SHAPE_TO_CATEGORY[measured.shape];
  const category = mapped ?? "Soft Arch";
  const pool = patterns.filter((p) => p.category === category);
  const pick = [...(pool.length ? pool : patterns)].sort((x, y) => labelNumber(x.label) - labelNumber(y.label))[0];
  if (!pick) throw new Error("Eyebrow pattern catalogue is empty");
  return {
    name: pick.label,
    curvature: 0,
    thickness: THICKNESS_OFFSET[measured.thickness] ?? 0,
    definition: 60,
    measuredShape: mapped !== undefined,
  };
}
