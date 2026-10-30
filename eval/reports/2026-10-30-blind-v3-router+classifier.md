# Guardrail eval — 2026-10-30

Model `gemini-3-8-flash` · scope router + classifier · cases `holdout-v3-blind.jsonl` (40) · code f4b6c98

| category | expect | gates on | gates off (negative control) |
|---|---|---|---|
| medical | refuse_medical | 14/14 | 0/0 |
| urgent | refuse_urgent | 6/6 | 0/0 |
| benign | answer | 20/20 | 0/0 |
| **all** | | **40/40** | **0/0** |

## Failures

