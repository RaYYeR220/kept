# Claims

Every public statement about Kept, tagged by how it can be checked.

- **REPRODUCIBLE** — run the command in this repository and get the same result.
- **VERIFIED-LIVE** — measured against the live YouCam API on 30 Oct 2026; the recorded responses are in `apps/web/fixtures/replay/`.
- **MODELED** — a design choice or a published figure, not something Kept measured.
- **NOT CLAIMED** — things we deliberately don't say.

## Measurement

| Claim | Tier | Evidence |
|---|---|---|
| A likeness is measured from four photos by Skin Tone, Face Analyzer, Hair Type, Hair Length, Hair Density and Fitzpatrick | VERIFIED-LIVE | `fixtures/replay/{anna,marcus}/capture.json` (task ids, units, timestamps) |
| Skin Tone and Face Analyzer need the face to fill most of the frame; Kept crops to the face found by YouCam's free pre-process step | VERIFIED-LIVE | `lib/server/crop.ts`; uncropped photos returned `error_face_position_too_small` |
| YouCam's hair-colour attribute read both personas (chestnut, black) as "Auburn", so Kept reads the hair shade itself | VERIFIED-LIVE | live test logs; `lib/server/sample.ts`, `packages/likeness/src/sample.ts` |
| Hair density needs a photo of the parting with part of the face visible | VERIFIED-LIVE | `error_face_angle_invalid` / `error_no_face` on other views |
| A failed YouCam task costs no units | VERIFIED-LIVE | balance unchanged after failed tasks |

## Brows

| Claim | Tier | Evidence |
|---|---|---|
| The makeup try-on draws brows on a face that has lost them | VERIFIED-LIVE | `fixtures/replay/*/renders/brows.jpg` |
| After YouCam re-measures the drawing and Kept corrects the colour, Anna's drawn brows read as the same shade measured before treatment (ΔE 17.6/11.8 → 0 over three rounds) | VERIFIED-LIVE | `fixtures/replay/anna/brows.json` |
| For Marcus the best round was ΔE 11.4 and a third round was worse (19.3) | VERIFIED-LIVE | `fixtures/replay/marcus/brows.json` |
| The try-on brightens the whole face (cheek ΔE ≈ 3.4–3.7 on both personas); Kept's correction brings it to ≈ 0.4–0.9 | REPRODUCIBLE | `lib/server/composite.ts` on the recorded renders |
| Brow colour is reported in steps (values recur exactly across different drawings) | VERIFIED-LIVE | repeated hex values in `brows.json` rounds |

## Wigs

| Claim | Tier | Evidence |
|---|---|---|
| Listings come live from Shopify Catalog via Shop MCP; Kept prepares a UCP checkout and never pays | REPRODUCIBLE | `packages/shop`, `/api/checkout` |
| Listing photos are read the same way as the person's photo and ranked by CIEDE2000 | REPRODUCIBLE | `/api/wigs/measure`, `packages/likeness/src/rank.ts` |
| 24 of 37 measured listings sat closer to another colour name's average shade than to their own; "light brown" read about as dark as "dark brown" | REPRODUCIBLE | `data/audit-*.json`, `pnpm --filter @kept/audit audit` |
| Colour bands (≤ 5 close, ≤ 10 near) | MODELED | `packages/likeness/src/thresholds.ts` |

## Safety

| Claim | Tier | Evidence |
|---|---|---|
| 40/40 on a blind held-out set written without access to Kept (14 medical, 6 urgent, 20 appearance) | REPRODUCIBLE | `eval/reports/2026-10-30-blind-v3-router+classifier.md` |
| The keyword router alone scored 29/40 on the same set | REPRODUCIBLE | `eval/reports/2026-10-30-blind-v3-router.md` |
| With the gates off, the model still deferred medical questions but named blocked nail products in 5 of 10 cases | REPRODUCIBLE | `eval/reports/2026-10-30-v1-router.md` |
| A misconfigured classifier failed closed: it refused every message and let no medical question through | REPRODUCIBLE | `eval/reports/*-misconfigured.md` |
| Product rules cite ACS and NCI guidance (fragrance, alcohol, salon nails, removers) | MODELED | `packages/likeness/src/rules.ts`, `citations.ts` |

## Not claimed

- Any medical benefit, diagnosis or treatment advice.
- That a wig or brow render will look exactly like the real product.
- That 40/40 on 40 messages means no errors outside that set.
- That the typical timeline applies to any individual.
- That Kept's hair-shade reading is a calibrated colorimeter: it reads photos as they were taken.
