---
name: review
description: Review a PR for what deterministic checks do not cover and write findings JSON
argument-hint: <pr number>
disable-model-invocation: true
---
Review the pull request given with this command.

Focus **only** on what CI and lint do not check:
1. Unchecked rows in `docs/AUTOMATION.md` → Enforcement map: external input validated with Zod; detected values are overridable `Draft<T>` with confidence.
2. Spec fit and acceptance criteria: each criterion in the linked spec/issue is actually verified.
3. User-facing prose (`README.md`, docs, UI text): concise, self-contained, no contradictions or overclaiming.
4. Player-facing behavior: anything that looks wrong, confusing, or broken for board game players.

Do not restate lint, formatting, or typecheck rules.

Write valid JSON to `.scratch/review-<pr>/findings.json` matching:
```json
{
  "findings": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "severity": "blocking | should-fix | nit",
      "summary": "Short description of the issue",
      "failureScenario": "What goes wrong if this ships"
    }
  ],
  "verdict": {
    "risk": "low | medium | high",
    "confidence": 0.9,
    "recommendation": "merge | fix | escalate",
    "reasons": ["Short reason"]
  }
}
```
