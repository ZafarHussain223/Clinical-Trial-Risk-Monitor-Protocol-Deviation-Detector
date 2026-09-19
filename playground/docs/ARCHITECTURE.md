# Architecture — Clinical Trial Risk Monitor

This document explains the data model, analysis pipeline, and rendering architecture of `dashboard.html`.

---

## Overview

The entire application is a single self-contained HTML file. There is no build step, no bundler, and no server-side component. All logic runs in the browser.

```
┌─────────────────────────────────────────────────────────────┐
│                      dashboard.html                          │
│                                                             │
│  ┌──────────┐    ┌─────────────────────────────────────┐   │
│  │  Login   │───▶│           bootstrapApp()            │   │
│  │  Overlay │    │  fetch → pipeline → seed → render   │   │
│  └──────────┘    └─────────────────────────────────────┘   │
│                                   │                         │
│              ┌────────────────────┼──────────────────┐      │
│              ▼                    ▼                   ▼      │
│        PATIENTS[]          ENGINE_RESULTS[]    TRIAGE_RESULTS[]
│        REGIONAL[]          GCP_RESULTS[]       DEVIATIONS[]   │
│        CAPA_LIST[]         REMINDERS[]         AUDIT_LOG[]    │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Patient Record

Created by `createPatient(raw)` from a flat raw object:

```js
{
  patientId: "PT-001",
  demographics: { age, gender, zipCode, region },
  preExistingConditions: ["hypertension", "COPD"],
  vitals: {
    temperatureC, temperatureF,
    bloodPressureSystolic, bloodPressureDiastolic,
    spO2, heartRate
  },
  symptoms: { onsetDate, reported: ["fever", "dry_cough", …] },
  labResults: {
    wbcCount, hbA1c, viralLoad, bloodGlucose,
    liverAlt, kidneyCreatinine, cReactiveProtein
  }
}
```

### Disease Database (`DISEASE_DB`)

Six disease profiles, each defining:
- `symptoms[]` — symptom key list
- `labKeys{}` — lab threshold rules (min/max)
- `vitalT{}` — vital threshold rules (critical `c`, warning `w`, optional `inv` for inverted direction)
- `qp` — quarantine/public health guidance
- `tx` — treatment guidance

Diseases: `covid19`, `influenza`, `pneumonia`, `sepsis`, `diabetes_type2`, `liver_disease`, `kidney_disease`

---

## Analysis Pipeline

Executed by `runPipeline()` after every data load or patient add.

### 1. Rules Engine — `engineEval(patient)`

**Input:** single patient record  
**Output:** `{ vitalFlags[], labFlags[], diseaseMatches[], infectiousFlags, isOutbreakCandidate }`

#### Vital flag thresholds
| Flag | Critical | Warning |
|---|---|---|
| Fever | ≥39°C | ≥38°C |
| SpO₂ low | <92% | <94% |
| Tachycardia | ≥120 bpm | ≥100 bpm |
| Hypotension | <90 mmHg | <100 mmHg |
| Hypertension | ≥180 mmHg | ≥140 mmHg |

#### Disease matching composite score
```
compositeScore = symptomOverlap×0.45 + labScore×0.35 + vitalScore×0.20
```
Diseases with score > 0.15 or ≥2 symptom overlaps are included in `diseaseMatches`.

---

### 2. Triage Classifier — `classifyTriage(patient, engine)`

**Input:** patient + engine result  
**Output:** `{ severityScore, severity, primarySuspectedDisease, actions, criticalVitalFlags, criticalLabFlags }`

#### Scoring weights
| Component | Points |
|---|---|
| SpO₂ < 88% | +40 |
| SpO₂ 88–91% | +20–30 |
| Temperature ≥40°C | +30 |
| SBP < 80 mmHg | +30 |
| HR ≥ 130 bpm | +20 |
| Critical vital flag | +10 each |
| Critical lab flag | +8 each |
| Outbreak candidate | +15 |
| Top disease (compositeScore) | up to +20 |
| Critical infectious disease | +20 |
| Age ≥70 | +10 |
| Age 60–69 | +5 |

Pre-existing condition multiplier applied last (max of all applicable):  
`heart_failure×1.25`, `COPD×1.2`, `CKD×1.2`, `diabetes×1.15`, `hypertension×1.1`

#### Severity thresholds
- **Critical**: score ≥ 65
- **Moderate**: score 35–64
- **Low**: score < 35

---

### 3. GCP Classifier — `classifyGCP(patient, triage, engine)`

**Input:** patient + triage + engine  
**Output:** `{ grade (1–5), label, definition, timeline, reportingObligation, saeFlag, autonote, gcpCriteria[] }`

| Grade | Trigger |
|---|---|
| 5 — Death | score ≥95 OR (SpO₂ <85% AND SBP <80) |
| 4 — Life-Threatening | score ≥75 OR (SpO₂ <90% AND sepsis) OR ≥3 critical vitals |
| 3 — Severe | score ≥55 OR severity=critical OR (≥2 critical vitals AND ≥1 critical lab) |
| 2 — Moderate | score ≥30 OR severity=moderate OR any critical vital or lab |
| 1 — Mild | all else |

Eight CTCAE criteria are evaluated per patient and shown in the GCP page.

---

### 4. Protocol Deviation Detector — `detectDeviations(patient, triage, engine)`

**Input:** patient + triage + engine  
**Output:** deviation object array

| Rule | Class | Trigger |
|---|---|---|
| Banned co-medication | **Major** | Any `preExistingConditions` entry contains a banned drug name |
| Dosing threshold violation | **Major** | SpO₂ < 94%, Temp > 38°C, or SBP outside 90–160 |
| Missed protocol visit window | **Minor** | `onsetAge > visitTarget + window` AND zero lab results (per window: Day 0±2, Week 2±3, Month 1±5, Month 3±7) |
| Elevated CRP without dose hold | **Minor** | CRP > 20 mg/L |
| Incomplete CRF | **Administrative** | SpO₂, HR, or temperature is null |

Protocol specification is defined in `PROTOCOL_SPEC` — modify the constants there to update trial rules.

---

### 5. Regional Analysis — `runRegional(patients, triages)`

**Input:** all patients + triages  
**Output:** regional risk objects array, sorted by risk score descending

For each region:
- Incidence rate per 100,000 population → incidence score (0–30)
- 7-day vs prior 7-day velocity ratio → velocity score (0–40)
- % critical patients → severity score (0–30)
- Composite risk score = `incidenceScore + velocityScore + severityScore` (capped at 100)
- **Outbreak triggered** at risk score ≥ 70

---

### 6. Site Risk Scorecard — `computeSiteRiskScores()`

**Input:** REGIONAL, CAPA_LIST, DEVIATIONS, PATIENTS, TRIAGE_RESULTS  
**Output:** site scorecard objects sorted by risk score descending

| Indicator | Formula | Max pts |
|---|---|---|
| Protocol Deviation Rate | `(major+minor devs / totalCases) × 100 × 1.2` | 40 |
| Critical Case Concentration | `(patients with score≥65 / totalPatients) × 100 × 0.6` | 30 |
| Outbreak Velocity | `(velocityRatio − 1) × 13` | 20 |
| CAPA Overdue Rate | `(overdueCAPAs / totalCAPAs) × 100 × 0.2` | 10 |

Thresholds: **HIGH** ≥60, **MODERATE** 30–59, **LOW** <30.

---

## State Management

All live state is held in module-level arrays. No framework, no reactivity system.

| Array | Contents | Rebuilt by |
|---|---|---|
| `PATIENTS[]` | Patient objects | `fetchGraphQLPatients()` or `SEED_RAW` |
| `ENGINE_RESULTS[]` | `engineEval()` output | `runPipeline()` |
| `TRIAGE_RESULTS[]` | `classifyTriage()` output | `runPipeline()` |
| `REGIONAL[]` | `runRegional()` output | `runPipeline()` |
| `GCP_RESULTS[]` | `classifyGCP()` output | `runPipeline()` |
| `DEVIATIONS[]` | `detectDeviations()` output | `runDeviationDetector()` |
| `CAPA_LIST[]` | CAPA objects | `seedCapas()`, `addCapa()` |
| `REMINDERS[]` | Reminder objects | `seedReminders()`, `addReminder()` |
| `AUDIT_LOG[]` | Audit events | `auditLog()` — every action |

Indexes are aligned: `PATIENTS[i]`, `ENGINE_RESULTS[i]`, `TRIAGE_RESULTS[i]`, `GCP_RESULTS[i]` all refer to the same patient.

---

## Data Fetch Layer

`fetchGraphQLPatients()` sends a POST to `GRAPHQL_ENDPOINT` with the `GET_PATIENTS` query.

If the endpoint is still the placeholder (`yourhospital.com`), `USE_SEED_FALLBACK` is `true` and the `SEED_RAW` data is used instead — no network call is made.

Error surfaces: network failure, HTTP 4xx/5xx, GraphQL `errors[]`, empty payload. All are caught by `bootstrapApp()` and shown in the fetch error banner with a Retry button.

---

## Role-Based Access

`CURRENT_USER` is set on login. Two roles:

- **`hospital`** — `visibleIndices()` filters patients to `CURRENT_USER.region` only. All render functions are overridden via the override pattern (e.g. `renderDashboard = function() { … }`) to respect visibility.
- **`fda`** — sees all patients. FDA Audit nav item shown; Add Patient hidden.

Logout clears `CURRENT_USER` and re-shows the login overlay.
