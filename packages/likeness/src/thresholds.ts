// Colour-match bands for wig ranking, in CIEDE2000 units.
// Starting values follow the common rule of thumb that ΔE00 under ~5 reads as the same
// colour family at a glance. They are recalibrated against the measured noise floor in
// data/audit-*.json (see scripts/audit); until then they are a modelled choice.
export const CLOSE_DE00 = 5;
export const NEAR_DE00 = 10;
