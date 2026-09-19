# Contributing to Clinical Trial Risk Monitor

Thank you for your interest in contributing. This is a single-file web application — contributions are straightforward.

## Getting Started

1. Fork the repository and clone your fork.
2. Open `dashboard.html` in your browser — no build step required.
3. Make your changes in `dashboard.html` (or add files to `docs/`).
4. Test in at least one modern browser (Chrome, Firefox, or Edge).
5. Open a pull request against `main`.

## Code Style

- All application logic lives in `dashboard.html` — keep it that way unless you have a strong reason to split.
- Use `const` and `let`; avoid `var`.
- Keep function names descriptive and camelCase.
- Each new deviation rule in `detectDeviations()` must include:
  - `id`, `patientId`, `site`, `class` (`major` | `minor` | `admin`)
  - `type`, `description`, `finding`, `mitigation`, `icdRef`

## Adding a New Protocol Deviation Rule

1. Open `dashboard.html` and find the `detectDeviations()` function (~line 3061).
2. Add your rule following the pattern of the existing checks.
3. If the rule changes the `PROTOCOL_SPEC` object, update the spec block above `detectDeviations()`.
4. Add the rule to the **Protocol Specification** panel in the HTML (`page-deviations`).
5. Document the rule in [`docs/GCP_COMPLIANCE.md`](docs/GCP_COMPLIANCE.md).

## Adding a New Seed Patient

Add a raw record to the `SEED_RAW` array (~line 1292). Required fields:

```js
{
  patientId: "PT-XXX",
  age, gender, zipCode, region,
  pre: [],            // pre-existing conditions
  tempC, bpS, bpD, spo2, hr,
  onset: "YYYY-MM-DD",
  sx: [],             // symptom keys from ALL_SYMPTOMS
  wbc, crp, vl, hba1c, gluc, alt, creat   // null if not available
}
```

## Reporting Issues

Open a GitHub Issue with:
- Browser and version
- Steps to reproduce
- Expected vs actual behaviour

## Pull Request Checklist

- [ ] Tested in a modern browser
- [ ] No console errors introduced
- [ ] New deviation rules documented in `docs/GCP_COMPLIANCE.md`
- [ ] Seed data changes use realistic clinical values
- [ ] No hardcoded credentials added (demo credentials in `USER_REGISTRY` are intentional)
