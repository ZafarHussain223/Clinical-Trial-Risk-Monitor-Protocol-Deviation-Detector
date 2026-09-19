# ICH E6 GCP Compliance Reference

This document maps the ICH E6 (R2) Good Clinical Practice guideline requirements to the features implemented in the Clinical Trial Risk Monitor.

---

## ICH E6 Sections Covered

| ICH E6 Section | Topic | Implementation |
|---|---|---|
| §4.5 | Investigational Product | Banned co-medication detection (Major deviation) |
| §4.8 | Informed Consent & Dosing | Dosing threshold violation detection (Major deviation) |
| §4.11 | Safety Reporting | CRP-triggered dose-hold review (Minor deviation) |
| §5.17 | Audit Trail | Immutable `AUDIT_LOG[]` — timestamp, user, event, detail |
| §6.4 | Case Report Forms | Incomplete CRF detection (Administrative deviation) |
| §8.3 | During Trial Conduct | Missed protocol visit window detection (Minor deviation) |

---

## Protocol Deviation Classification

The dashboard implements the three-tier ICH E6 GCP deviation classification:

### Major Deviation
**Definition:** Directly impacts subject safety or data integrity.

| Rule | Trigger | Required Action | Timeline |
|---|---|---|---|
| Banned Co-Medication | `preExistingConditions` includes warfarin, MAOIs, methotrexate, thalidomide, or clozapine | Immediate CAPA — sponsor & IRB notification | Within 24–72 hours |
| Dosing Threshold Violation | SpO₂ < 94% OR Temp > 38°C OR SBP < 90 OR SBP > 160 at time of dosing | Hold dose, notify PI, raise CAPA, file IND safety report | Within 24 hours |

### Minor Deviation
**Definition:** Minor impact on data quality; no direct patient safety risk.

| Rule | Trigger | Required Action | Timeline |
|---|---|---|---|
| Missed Protocol Visit — Day 0 | Onset > 2 days ago, zero lab results | Schedule follow-up within 3 days, document in source | Within 7 days |
| Missed Protocol Visit — Week 2 | Onset > 17 days ago, zero lab results | Schedule follow-up within 3 days, document in source | Within 7 days |
| Missed Protocol Visit — Month 1 | Onset > 35 days ago, zero lab results | Schedule follow-up within 3 days, document in source | Within 7 days |
| Missed Protocol Visit — Month 3 | Onset > 97 days ago, zero lab results | Schedule follow-up within 3 days, document in source | Within 7 days |
| Elevated CRP | CRP > 20 mg/L without documented dose-hold review | Physician review and document decision within 48h | Within 7 days |

### Administrative Deviation
**Definition:** Process or paperwork issue; no data or safety impact.

| Rule | Trigger | Required Action | Timeline |
|---|---|---|---|
| Incomplete CRF | SpO₂, heart rate, or temperature is null | Complete CRF at next visit, document reason | Next monitoring visit |

---

## CTCAE Grading (ICH E6 GCP Adverse Event Classification)

The GCP Classifier maps triage severity to CTCAE grades:

| Grade | Label | Score Threshold | Reporting Obligation | Timeline |
|---|---|---|---|---|
| 1 | Mild | < 30 | Source document only | Per scheduled visit |
| 2 | Moderate | ≥ 30 or any critical flag | Scheduled AE report | Within 7 days (routine) |
| 3 | Severe | ≥ 55 or severity = critical | Expedited IND safety report | Within 15 days |
| 4 | Life-Threatening (SAE) | ≥ 75 or (SpO₂ < 90% + sepsis) or ≥ 3 critical vitals | SAE — IRB/Ethics mandatory notification | Within 7 days |
| 5 | Death | ≥ 95 or (SpO₂ < 85% + SBP < 80) | Immediate regulatory notification, full investigation | Within 24 hours |

### CTCAE Criteria Evaluated Per Patient

1. Requires hospitalization or prolongation (score ≥ 55 or critical severity)
2. Results in persistent/significant disability (sepsis or kidney disease + score ≥ 60)
3. Life-threatening vital compromise (SpO₂ < 92%, SBP < 90, or HR ≥ 130)
4. Requires urgent medical/surgical intervention (critical severity)
5. Abnormal laboratory values CTCAE Grade ≥ 2 (any critical lab flag)
6. Medically important condition per investigator (score ≥ 35)
7. Congenital anomaly / birth defect (not applicable — always false)
8. Death criteria (score ≥ 95)

---

## CAPA Requirements (ICH E6 §8)

### Auto-Generated CAPAs

| Trigger | CAPA Type | Due Date | Initial Status |
|---|---|---|---|
| GCP Grade ≥ 4 | Adverse Event | + 2 days | Open |
| GCP Grade 3 | Corrective Action | + 7 days | In Progress |

### Audit Trail Requirements (ICH E6 §5.17)

Every event is logged with:
- ISO 8601 timestamp
- User attribution (email or "System")
- Event type (e.g. `CAPA_RAISED`, `PATIENT_ADDED`, `LOGIN_SUCCESS`)
- Detail string

Logged events:
- `LOGIN_SUCCESS` / `LOGOUT`
- `DATA_LOADED` — patient count and source (seed vs GraphQL)
- `PATIENT_ADDED` — patient ID, severity, score
- `CAPA_RAISED` — CAPA ID, patient ID, GCP grade
- `CAPA_STATUS_CHANGE` — CAPA ID, old → new status
- `REMINDER_SCHEDULED` / `REMINDER_SENT` / `REMINDER_BULK_SENT`
- `EXPORT` — CAPA CSV export
- `DEVIATION_REPORT_EXPORTED` — deviation count

---

## Trial Protocol Specification (P1-CT-2025)

```
Banned co-medications:  warfarin, MAOIs, methotrexate, thalidomide, clozapine

Dosing thresholds:
  SpO₂ must be ≥ 94%
  Temperature must be ≤ 38.0°C
  Systolic BP must be 90–160 mmHg

Visit schedule:
  Day 0   ± 2 days   (Enrollment)
  Week 2  ± 3 days
  Month 1 ± 5 days
  Month 3 ± 7 days
```

To modify the protocol spec for a different trial, update the `PROTOCOL_SPEC` constant in `dashboard.html` (~line 3031).

---

## Regulatory Export Formats

### CAPA-Ready Deviation Report (JSON)

Exported via the **CAPA-Ready Report** button on the Protocol Deviations page.

```json
{
  "reportType": "CAPA_READY_PROTOCOL_DEVIATION_REPORT",
  "trial": "P1-CT-2025",
  "generatedAt": "<ISO timestamp>",
  "summary": {
    "totalDeviations": 12,
    "major": 4,
    "minor": 6,
    "administrative": 2,
    "patientsAffected": 8
  },
  "deviations": [
    {
      "deviationId": "DEV-PT-011-COMED",
      "patientId": "PT-011",
      "site": "Brooklyn West",
      "class": "major",
      "type": "Banned Co-Medication",
      "description": "...",
      "finding": "...",
      "recommendedMitigation": "...",
      "ichReference": "ICH E6 §4.5 — Investigational Product",
      "requiredTimeline": "Within 24–72 hours",
      "capaRequired": true
    }
  ],
  "capaActions": [
    {
      "linkedDeviation": "DEV-PT-011-COMED",
      "patientId": "PT-011",
      "site": "Brooklyn West",
      "priority": "IMMEDIATE",
      "action": "Immediate CAPA — Sponsor & IRB notification required",
      "mitigation": "..."
    }
  ]
}
```

### CAPA Log (CSV)

Exported from the CAPA module. Columns:  
`ID, Type, PatientID, Description, RootCause, Owner, DueDate, Status, GCPGrade, RaisedAt`

### Patient Case Log (CSV)

Exported from the Reports page. Columns:  
`PatientID, Age, Gender, Region, ZIP, OnsetDate, Severity, SeverityScore, PrimaryDiagnosis, ICD10, IsOutbreakCandidate, ContactTracing, CriticalVitalFlags, CriticalLabFlags`
