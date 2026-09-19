# 🏥 Clinical Trial Risk Monitor & Protocol Deviation Detector

> **Pharma & Biotech — P1 Critical**  
> Real-time ICH E6 GCP compliance monitoring, site-level risk scoring, and CAPA-ready reporting — entirely in the browser, no server required.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![ICH E6 GCP](https://img.shields.io/badge/ICH%20E6-GCP%20Aligned-green)](docs/GCP_COMPLIANCE.md)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-brightgreen)](#)

---

## The Problem

A major clinical trial has **5,000+ patient visits across 200+ sites**. Protocol deviations — missed visits, wrong dosing, banned co-medications — go undetected until the FDA audit. A single rejected submission delays drug approval by **6–12 months** and costs **$50–100M**.

Risk managers need real-time visibility into which sites are highest risk _before_ problems escalate.

---

## The Solution

**MedTrack** is a fully client-side dashboard that:

| Requirement | How it's met |
|---|---|
| Compare patient records against protocol spec | `detectDeviations()` — 5 rules against Trial P1-CT-2025 |
| Classify each deviation (Major / Minor / Admin) | `DEV_CLASS` with ICH E6 timelines & required actions |
| Score site-level risk using leading indicators | `computeSiteRiskScores()` — 4 weighted indicators, 0–100 |
| Generate CAPA-ready reports with mitigations | One-click JSON export with ICH references per deviation |

---

## Quick Start

```bash
# Clone
git clone https://github.com/your-org/clinical-trial-risk-monitor.git
cd clinical-trial-risk-monitor

# Open — no build step, no install
open dashboard.html          # macOS
start dashboard.html         # Windows
xdg-open dashboard.html      # Linux
```

### Demo Credentials

| Role | Email | Password |
|---|---|---|
| **FDA Auditor** (full access) | `auditor@fda.gov` | `fda2025` |
| Hospital — Manhattan North | `admin@manhattan-north.org` | `pass123` |
| Hospital — Manhattan South | `admin@manhattan-south.org` | `pass123` |
| Hospital — Brooklyn West | `admin@brooklyn-west.org` | `pass123` |
| Hospital — Queens | `admin@queens-medical.org` | `pass123` |
| Hospital — Bronx | `admin@bronx-care.org` | `pass123` |
| Hospital — Staten Island | `admin@staten-island.org` | `pass123` |

---

## Features

### 📊 Dashboard
- KPI cards: total patients, critical alerts, active outbreaks, high-risk zones
- Severity distribution bar chart
- Top suspected diagnoses by ICD-10 frequency
- Critical triage alerts with one-click patient detail modal

### 👥 Patient Monitor
- Full patient table sorted by severity score
- Filter by severity level and region
- Click any row for detailed vitals, rule engine flags, differential diagnosis, and action plan

### ⚠️ Protocol Deviation Detector *(core feature)*
- **Trial P1-CT-2025** protocol spec enforced in real time
- 5 deviation rules automatically evaluated per patient:
  1. **Major** — Banned co-medication (warfarin, MAOIs, methotrexate, thalidomide, clozapine)
  2. **Major** — Dosing threshold violation (SpO₂ < 94%, Temp > 38°C, SBP outside 90–160)
  3. **Minor** — Missed protocol visit window (Day 0 ±2d, Week 2 ±3d, Month 1 ±5d, Month 3 ±7d)
  4. **Minor** — Elevated CRP (> 20 mg/L) without documented dose-hold review
  5. **Administrative** — Incomplete CRF entry (missing vital signs)
- Per-deviation recommended mitigation with ICH reference
- One-click **CAPA-Ready Report** export (JSON)
- Trial context banner: live site count + dynamic FDA Audit Risk level

### 📈 Site Risk Monitor *(core feature)*
- 4 leading indicators scored per site:
  - Protocol Deviation Rate (max 40 pts)
  - Critical Case Concentration (max 30 pts)
  - Outbreak Velocity — 7-day growth ratio (max 20 pts)
  - CAPA Overdue Rate (max 10 pts)
- Composite 0–100 site risk score
- **HIGH** (≥60): freeze enrolment, on-site audit within 72h
- **MODERATE** (30–59): remote monitoring visit within 2 weeks
- **LOW** (<30): standard schedule

### 🏥 ICH E6 GCP Classifier *(core feature)*
- Every patient auto-graded Grade 1–5 (CTCAE)
- Grade ≥ 3 → expedited IND safety report required
- Grade ≥ 4 → SAE mandatory — IRB/sponsor notification note generated
- 8 GCP criteria evaluated per patient (hospitalization, life-threatening vitals, lab abnormalities…)

### 📋 CAPA Module — ICH E6 §8 Audit-Ready
- Auto-CAPA generation for GCP Grade ≥ 3 patients
- Manual CAPA form: type, linked patient, root cause, owner, due date
- Status workflow: Open → In Progress → Closed (with auto overdue detection)
- Immutable audit trail — every action timestamped and attributed
- Export CAPA log as CSV

### 🌍 Regional Risk & Outbreak Detection
- Geographic risk heatmap (6 NYC regions)
- Outbreak trigger at risk score ≥ 70 — automated containment actions dispatched
- Velocity ratio: last 7 days vs prior 7 days case growth

### 🔔 Hospital Reminders
- Auto-generated pre-admission (−1 day) and post-treatment (+2 day) reminders
- Per-severity reminder notes (ICU prep for critical, admission slot for moderate)
- Custom reminder scheduler
- Mark as sent / bulk mark all pending

### 🏛️ FDA Hospital Audit (FDA role only)
- Cross-hospital patient table with per-site filtering
- Per-hospital CAPA summary
- Full scoped audit trail per hospital

### ➕ Add Patient
- Live form with symptom chips and pre-condition selector
- Immediate triage result + deviation + CAPA + reminder generation on submit
- All pages update in real time

---

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full pipeline breakdown.

```
Patient Record
    │
    ├─► engineEval()          — vital flags, lab flags, disease matches (6 conditions)
    │
    ├─► classifyTriage()      — severity score 0–100, action plan generation
    │
    ├─► classifyGCP()         — ICH E6 CTCAE Grade 1–5, regulatory obligations
    │
    ├─► detectDeviations()    — 5 ICH E6 GCP protocol rules → Major/Minor/Admin
    │
    ├─► runRegional()         — per-region risk score, outbreak detection, velocity
    │
    └─► computeSiteRiskScores() — 4-indicator site scorecard
```

---

## Connecting a Real Backend

The app ships with seed data for offline/demo use. To point it at a real GraphQL API:

1. Open `dashboard.html` and find the two constants near line 1241:
   ```js
   const GRAPHQL_ENDPOINT   = "https://api.yourhospital.com/graphql";
   const GRAPHQL_AUTH_TOKEN = "Bearer YOUR_TOKEN_HERE";
   ```
2. Replace with your real endpoint and bearer token.
3. The app automatically falls back to seed data while the placeholders remain.

See the `GET_PATIENTS` GraphQL query and `mapGraphQLRecord()` function for the expected schema.

---

## Project Structure

```
clinical-trial-risk-monitor/
├── dashboard.html              # Entire application (self-contained)
├── docs/
│   ├── ARCHITECTURE.md         # Engine & pipeline deep-dive
│   ├── GCP_COMPLIANCE.md       # ICH E6 GCP requirement mapping
│   └── DEMO_GUIDE.md           # Step-by-step demo script
├── ClinicalTrialRiskMonitor.pptx  # Jury presentation (10 slides)
├── README.md
├── CONTRIBUTING.md
└── LICENSE
```

---

## Compliance References

| Standard | Coverage |
|---|---|
| ICH E6 (R2) Good Clinical Practice | Deviation classification, CAPA requirements, audit trail (§8) |
| CTCAE v5.0 | Grade 1–5 adverse event classification |
| 21 CFR Part 11 | Audit trail immutability principle |
| FDA Form 3500A | Referenced in HIGH-risk site recommended actions |

---

## Built With

- **IBM Bob** — AI-assisted development
- Vanilla HTML/CSS/JavaScript — zero runtime dependencies
- No build tools, no frameworks, no server

---

## License

MIT — see [LICENSE](LICENSE).
