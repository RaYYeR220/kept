# Review in five minutes

1. **Open https://kept-likeness.vercel.app** — the landing page. "Save my likeness" opens the app.
2. **Tick the consent box and choose "Try with Anna".** Anna is a synthetic demo person; her four photos and every measurement are recorded results from the live YouCam API.
3. **Measure Anna** → the Likeness card. Each value shows the YouCam API and date that produced it; hair shade is labelled as read by Kept.
4. **Brows** → "Draw my brows back". Slide between today and the drawing. The "Checked by YouCam" card shows the calibration rounds (ΔE 11.8 → same shade).
5. **Hair** → live Shopify listings, each listing photo read for hair shade (no units spent) and ranked by colour distance. The pinned listing has a recorded try-on: "Try it on me". "Prepare checkout" opens the store's own review-and-pay page.
6. **Ask** → try "Can I use retinol on paclitaxel?" (care-team card, the model never sees it) and "Which wig would match me best?". Open "What happened behind this answer" to see the gates.
7. **Share** → create a link and open it: the specialist view.
8. **/proof** → the guardrail evaluation, including the runs that went badly.

Code and evidence: [README](README.md) · [CLAIMS](CLAIMS.md) · `eval/` · `apps/web/fixtures/replay/` · `data/`.
