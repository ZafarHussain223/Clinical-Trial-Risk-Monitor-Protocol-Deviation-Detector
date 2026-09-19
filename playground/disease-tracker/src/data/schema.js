/**
 * Data Schema & Ingestion Layer
 * Patient Intake, Vital Logs, and Disease Reference Database
 */

// ─── Patient Record Schema ────────────────────────────────────────────────────

/**
 * Creates a validated patient record
 * @param {Object} raw - Raw intake data
 * @returns {Object} Validated patient record
 */
export function createPatientRecord(raw) {
  return {
    patientId: raw.patientId || generateId(),
    timestamp: raw.timestamp || new Date().toISOString(),
    demographics: {
      age: Number(raw.age),
      gender: raw.gender || "unknown",
      zipCode: raw.zipCode || "00000",
      region: raw.region || "Unassigned",
    },
    preExistingConditions: Array.isArray(raw.preExistingConditions)
      ? raw.preExistingConditions
      : [],
    vitals: {
      temperatureC: Number(raw.temperatureC),        // °C
      temperatureF: raw.temperatureC
        ? celsiusToFahrenheit(Number(raw.temperatureC))
        : Number(raw.temperatureF),
      bloodPressureSystolic: Number(raw.bloodPressureSystolic),   // mmHg
      bloodPressureDiastolic: Number(raw.bloodPressureDiastolic), // mmHg
      spO2: Number(raw.spO2),           // % oxygen saturation
      heartRate: Number(raw.heartRate), // bpm
    },
    symptoms: {
      onsetDate: raw.onsetDate || new Date().toISOString().split("T")[0],
      reported: Array.isArray(raw.symptoms) ? raw.symptoms : [],
    },
    labResults: {
      wbcCount: raw.wbcCount ?? null,          // 10^3/µL
      hbA1c: raw.hbA1c ?? null,               // %
      viralLoad: raw.viralLoad ?? null,        // copies/mL
      bloodGlucose: raw.bloodGlucose ?? null, // mg/dL
      liverAlt: raw.liverAlt ?? null,          // U/L
      kidneyCreatinine: raw.kidneyCreatinine ?? null, // mg/dL
      cReactiveProtein: raw.cReactiveProtein ?? null, // mg/L
    },
    meta: {
      ingestedAt: new Date().toISOString(),
      source: raw.source || "manual_intake",
    },
  };
}

// ─── Disease Reference Database ──────────────────────────────────────────────

export const DISEASE_DB = {
  influenza: {
    id: "influenza",
    name: "Influenza (Flu)",
    type: "infectious",
    diagnosticCriteria: [
      "fever_high",
      "sudden_onset",
      "body_aches",
      "fatigue",
      "respiratory_symptoms",
    ],
    primarySymptoms: ["fever", "chills", "body_aches", "fatigue", "cough", "sore_throat", "headache"],
    criticalLabBoundaries: {
      wbcCount: { min: null, max: 4.0, unit: "10³/µL", note: "Leukopenia common in influenza" },
    },
    vitalThresholds: {
      temperatureC: { critical: 39.5, warning: 38.0 },
      spO2: { critical: 92, warning: 94 },
    },
    quarantineProtocol: "Isolate 5–7 days from symptom onset or until fever-free 24h",
    treatmentProtocol: "Antiviral therapy (oseltamivir) within 48h of onset; supportive care",
    icdCode: "J11",
  },

  covid19: {
    id: "covid19",
    name: "COVID-19",
    type: "infectious",
    diagnosticCriteria: [
      "fever_high",
      "respiratory_distress",
      "loss_of_taste_smell",
      "fatigue",
    ],
    primarySymptoms: [
      "fever", "dry_cough", "fatigue", "loss_of_taste", "loss_of_smell",
      "shortness_of_breath", "chest_pain", "body_aches",
    ],
    criticalLabBoundaries: {
      wbcCount: { min: null, max: 4.0, unit: "10³/µL" },
      cReactiveProtein: { min: 10, max: null, unit: "mg/L", note: "Elevated in severe cases" },
      viralLoad: { min: 1000, max: null, unit: "copies/mL" },
    },
    vitalThresholds: {
      temperatureC: { critical: 39.0, warning: 38.0 },
      spO2: { critical: 92, warning: 94 },
      heartRate: { critical: 120, warning: 100 },
    },
    quarantineProtocol: "Isolate 10 days from symptom onset; notify close contacts",
    treatmentProtocol: "Supportive care; antivirals for high-risk patients; ICU monitoring if SpO2 < 92%",
    icdCode: "U07.1",
  },

  diabetes_type2: {
    id: "diabetes_type2",
    name: "Type 2 Diabetes",
    type: "chronic",
    diagnosticCriteria: ["elevated_hba1c", "elevated_glucose", "polydipsia", "polyuria"],
    primarySymptoms: [
      "frequent_urination", "excessive_thirst", "blurred_vision",
      "slow_healing_wounds", "fatigue", "numbness_tingling",
    ],
    criticalLabBoundaries: {
      hbA1c: { min: 6.5, max: null, unit: "%", note: "≥6.5% diagnostic threshold" },
      bloodGlucose: { min: 200, max: null, unit: "mg/dL", note: "Fasting ≥126 mg/dL diagnostic" },
    },
    vitalThresholds: {
      bloodPressureSystolic: { critical: 180, warning: 140 },
    },
    quarantineProtocol: "Not applicable — chronic metabolic condition",
    treatmentProtocol: "Metformin first-line; lifestyle modification; glucose monitoring; HbA1c re-check in 3 months",
    icdCode: "E11",
  },

  sepsis: {
    id: "sepsis",
    name: "Sepsis",
    type: "critical_infectious",
    diagnosticCriteria: ["fever_high", "elevated_wbc", "elevated_crp", "tachycardia", "hypotension"],
    primarySymptoms: [
      "high_fever_or_hypothermia", "confusion", "rapid_breathing",
      "rapid_heart_rate", "extreme_pain", "clammy_skin",
    ],
    criticalLabBoundaries: {
      wbcCount: { min: 12.0, max: null, unit: "10³/µL", note: "Leukocytosis >12,000" },
      cReactiveProtein: { min: 20, max: null, unit: "mg/L" },
    },
    vitalThresholds: {
      temperatureC: { critical: 38.3, warning: 38.0 },
      heartRate: { critical: 90, warning: 85 },
      bloodPressureSystolic: { critical: 90, warning: 100 },
      spO2: { critical: 92, warning: 94 },
    },
    quarantineProtocol: "ICU isolation protocol; source control required",
    treatmentProtocol: "IV broad-spectrum antibiotics within 1 hour; fluid resuscitation; vasopressors if refractory hypotension",
    icdCode: "A41.9",
  },

  pneumonia: {
    id: "pneumonia",
    name: "Pneumonia",
    type: "infectious",
    diagnosticCriteria: ["fever_high", "respiratory_distress", "productive_cough", "chest_xray_infiltrate"],
    primarySymptoms: [
      "fever", "chills", "productive_cough", "shortness_of_breath",
      "chest_pain", "fatigue", "confusion",
    ],
    criticalLabBoundaries: {
      wbcCount: { min: 11.0, max: null, unit: "10³/µL" },
      cReactiveProtein: { min: 15, max: null, unit: "mg/L" },
    },
    vitalThresholds: {
      temperatureC: { critical: 39.0, warning: 38.0 },
      spO2: { critical: 92, warning: 94 },
      heartRate: { critical: 125, warning: 100 },
    },
    quarantineProtocol: "Standard respiratory precautions; mask required",
    treatmentProtocol: "Antibiotics (community vs hospital-acquired); supplemental O2; hospitalization if SpO2 < 94%",
    icdCode: "J18.9",
  },

  liver_disease: {
    id: "liver_disease",
    name: "Hepatic Dysfunction",
    type: "chronic",
    diagnosticCriteria: ["elevated_alt", "jaundice", "abdominal_pain", "fatigue"],
    primarySymptoms: [
      "jaundice", "abdominal_pain", "nausea", "fatigue",
      "dark_urine", "pale_stools", "easy_bruising",
    ],
    criticalLabBoundaries: {
      liverAlt: { min: 56, max: null, unit: "U/L", note: "Normal range 7–56 U/L" },
    },
    vitalThresholds: {},
    quarantineProtocol: "Not typically required unless viral hepatitis",
    treatmentProtocol: "Eliminate hepatotoxins; specialist referral; antiviral if hepatitis B/C confirmed",
    icdCode: "K76.9",
  },

  kidney_disease: {
    id: "kidney_disease",
    name: "Renal Dysfunction",
    type: "chronic",
    diagnosticCriteria: ["elevated_creatinine", "reduced_urine_output", "edema"],
    primarySymptoms: [
      "edema", "decreased_urination", "fatigue", "nausea",
      "shortness_of_breath", "confusion",
    ],
    criticalLabBoundaries: {
      kidneyCreatinine: { min: 1.3, max: null, unit: "mg/dL", note: "Normal: 0.7–1.3 mg/dL (male)" },
    },
    vitalThresholds: {
      bloodPressureSystolic: { critical: 180, warning: 140 },
    },
    quarantineProtocol: "Not applicable",
    treatmentProtocol: "Nephrology referral; BP management; dietary modifications; dialysis if GFR < 15",
    icdCode: "N18",
  },
};

// ─── Lab Reference Ranges ────────────────────────────────────────────────────

export const LAB_REFERENCE_RANGES = {
  wbcCount:          { min: 4.5,  max: 11.0, unit: "10³/µL",  name: "White Blood Cell Count" },
  hbA1c:             { min: 4.0,  max: 5.6,  unit: "%",        name: "Hemoglobin A1c" },
  bloodGlucose:      { min: 70,   max: 99,   unit: "mg/dL",    name: "Fasting Blood Glucose" },
  liverAlt:          { min: 7,    max: 56,   unit: "U/L",      name: "ALT (Liver)" },
  kidneyCreatinine:  { min: 0.7,  max: 1.3,  unit: "mg/dL",   name: "Creatinine (Kidney)" },
  cReactiveProtein:  { min: 0,    max: 3,    unit: "mg/L",     name: "C-Reactive Protein" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId() {
  return "PT-" + Math.random().toString(36).substr(2, 9).toUpperCase();
}

function celsiusToFahrenheit(c) {
  return parseFloat((c * 9 / 5 + 32).toFixed(1));
}

export { generateId, celsiusToFahrenheit };
