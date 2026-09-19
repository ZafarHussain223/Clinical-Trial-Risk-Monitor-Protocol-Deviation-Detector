# 🏥 Disease & Symptom Tracking Platform

Enterprise-grade epidemiological surveillance platform that monitors patient health records, detects early disease symptoms, classifies diagnostic risks, tracks regional infection velocity, and generates clinical action reports.

---

## Project Structure

```
disease-tracker/
├── dashboard.html               ← Live interactive dashboard (open in any browser)
├── package.json
├── src/
│   ├── data/
│   │   ├── schema.js            ← Patient schema, Disease Reference DB, Lab ranges
│   │   └── samplePatients.js   ← 10 representative patient records
│   ├── engine/
│   │   ├── rulesEngine.js       ← Multi-factor symptom/vital/lab rules engine
│   │   ├── triageClassifier.js  ← Severity scoring & action plan generator
│   │   └── epidemiology.js      ← Regional cluster/velocity/outbreak scoring
│   ├── reports/
│   │   └── reportGenerator.js   ← Clinical summaries & public health exports
│   └── pipeline.js              ← Central orchestration of all modules
└── tests/
    └── integration.test.js      ← End-to-end test suite
```

---

## Module Overview

### 1. Data Schema & Ingestion (`src/data/schema.js`)

- **`createPatientRecord(raw)`** — Validates and normalizes patient intake data:  
  `patientId`, `age`, `gender`, `region/zipCode`, `preExistingConditions[]`,  
  vitals (`temperatureC/F`, `bloodPressureSystolic/Diastolic`, `spO2`, `heartRate`),  
  `symptoms.onsetDate`, `symptoms.reported[]`, and lab values (`wbcCount`, `hbA1c`, `viralLoad`, `bloodGlucose`, `liverAlt`, `kidneyCreatinine`, `cReactiveProtein`).

- **`DISEASE_DB`** — 7-disease reference knowledge base (COVID-19, Influenza, Pneumonia, Sepsis, Type 2 Diabetes, Hepatic Dysfunction, Renal Dysfunction) with diagnostic criteria, symptom arrays, critical lab boundaries, vital thresholds, ICD-10 codes, quarantine and treatment protocols.

- **`LAB_REFERENCE_RANGES`** — Standard clinical reference ranges for all 7 tracked biomarkers.

---

### 2. Rules Engine (`src/engine/rulesEngine.js`)

- **`evaluatePatient(patient)`** — Real-time multi-factor evaluation:
  - **Vital flags**: Fever (≥38°C warning, ≥39°C critical), SpO₂ (< 94% warning, < 92% critical), Tachycardia, Hypotension, Hypertension
  - **Lab flags**: Compares against `LAB_REFERENCE_RANGES`; secondary critical thresholds for severe derangements
  - **Symptom clusters**: 7 pre-defined clusters (respiratory outbreak, COVID-19 signature, sepsis, diabetic, hepatic, renal, flu) with configurable minimum-match requirements
  - **Disease matching**: Composite score = `symptom overlap (45%) + lab criteria (35%) + vital thresholds (20%)` matched against all diseases in `DISEASE_DB`
  - **Infectious outbreak check**: Flags fever + respiratory distress, sudden-onset clusters, high viral load, elevated CRP

---

### 3. Triage Classifier (`src/engine/triageClassifier.js`)

- **`classifySeverity(patient, engineResult)`** — Computes a **0–100 severity score**:
  - Vital sign weights (SpO₂ carries maximum 40 pts; temperature up to 30 pts)
  - Lab abnormality weights
  - Critical flag bonuses (+10 per critical vital flag, +8 per critical lab flag)
  - Outbreak candidate bonus (+15)
  - Disease type bonus (+20 for `critical_infectious`)
  - Pre-existing condition multipliers (e.g., heart failure ×1.25, COPD ×1.20)
  - Age adjustment (+5 for ≥60, +10 for ≥70)

- **Thresholds**: Score ≥65 → Critical, 35–64 → Moderate, <35 → Low

- **Action plan auto-generation**:
  - **Critical**: ICU triage alert, physician notification, CBC/blood cultures/CT, contact tracing
  - **Moderate**: Priority appointment, lab order generation, telehealth follow-up
  - **Low**: Patient care instructions, digital check-in reminders, OTC guidance

---

### 4. Epidemiological Module (`src/engine/epidemiology.js`)

- **`aggregateByRegion(patients, triageResults)`** — Groups cases within a trailing **14-day** window by region and zip code.

- **`computeGrowthVelocity(casesByDay)`** — Computes a **7-day velocity ratio** (last 7d cases ÷ prior 7d cases). Trend labels: `surging` (>1.5×), `rising` (>1.1×), `stable`, `declining` (<0.7×).

- **`computeOutbreakRiskScore(regionData, population)`** — **0–100 score** from 3 components:
  | Component | Max Points | Formula |
  |-----------|-----------|---------|
  | Incidence Rate | 30 | Cases per 100,000 in 14d |
  | Growth Velocity | 40 | 7-day velocity ratio |
  | Severity Composition | 30 | % critical cases |

- **Containment triggers**: Score **≥70** auto-triggers:
  - 🚨 Public health alert
  - 🏥 Local clinic network flag
  - 🔍 Contact-tracing workflow
  - 📦 Medical supply pre-positioning
  - 📢 Community mass notification (if score ≥85)

---

### 5. Report Generator (`src/reports/reportGenerator.js`)

- **`generatePatientClinicalSummary(patient, engineResult, triageResult)`** — Standardized per-patient clinical summary including vitals, symptom timeline, rule engine flags, differential diagnoses with ICD-10 codes, and the full clinical action plan.

- **`generatePublicHealthReport(patients, triageResults, engineResults, regionalAnalysis)`** — Regulatory-ready epidemiological export with case summary log, regional breakdown, ICD-10 frequency table, and all active containment action logs.

---

### 6. Live Dashboard (`dashboard.html`)

Open **`dashboard.html`** in any modern browser — no server or build step required.

#### Pages:
| Page | Contents |
|------|----------|
| **Dashboard** | KPI bar (Total Patients, Critical Alerts, Active Outbreaks, High-Risk Zones), severity distribution, top suspected diagnoses, critical alert feed |
| **Patient Monitor** | Filterable table sorted by severity score with color-coded risk badges, click-through to full detail modal |
| **Regional Risk** | Geographic heatmap + regional detail table with velocity ratios and risk scores |
| **Containment Alerts** | Per-region outbreak cards with all active automated containment workflows |
| **Reports & Export** | Epidemiological summary, ICD-10 frequency, containment log; one-click JSON and CSV export |

---

## Running the Test Suite

Requires Node.js 18+:

```bash
cd disease-tracker
npm test
```

The test suite validates:
- Patient record ingestion and field normalization
- Rules engine vital/lab/cluster/disease matching
- Known-outcome assertions (PT-001 → Critical, PT-010 → Low/Moderate)
- Velocity and outbreak risk score computation
- End-to-end pipeline output integrity

---

## Clinical Reference Thresholds

| Vital Sign | Warning | Critical |
|------------|---------|----------|
| Temperature | ≥38°C | ≥39°C |
| SpO₂ | <94% | <92% |
| Heart Rate | ≥100 bpm | ≥120 bpm |
| Systolic BP (low) | <100 mmHg | <90 mmHg |
| Systolic BP (high) | ≥140 mmHg | ≥180 mmHg |

| Lab Marker | Reference Range | Unit |
|------------|----------------|------|
| WBC Count | 4.5–11.0 | 10³/µL |
| HbA1c | 4.0–5.6 | % |
| Blood Glucose | 70–99 | mg/dL |
| ALT | 7–56 | U/L |
| Creatinine | 0.7–1.3 | mg/dL |
| CRP | 0–3 | mg/L |
