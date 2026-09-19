/**
 * Automated Disease & Symptom Rules Engine
 * Real-time multi-factor matching against the disease reference database
 */

import { DISEASE_DB, LAB_REFERENCE_RANGES } from "../data/schema.js";

// ─── Vital Flag Thresholds ────────────────────────────────────────────────────

const VITAL_FLAGS = {
  FEVER_CRITICAL:         (v) => v.temperatureC >= 39.0,
  FEVER_WARNING:          (v) => v.temperatureC >= 38.0,
  RESP_DISTRESS_CRITICAL: (v) => v.spO2 < 92,
  RESP_DISTRESS_WARNING:  (v) => v.spO2 < 94,
  TACHYCARDIA_CRITICAL:   (v) => v.heartRate >= 120,
  TACHYCARDIA_WARNING:    (v) => v.heartRate >= 100,
  HYPOTENSION_CRITICAL:   (v) => v.bloodPressureSystolic < 90,
  HYPOTENSION_WARNING:    (v) => v.bloodPressureSystolic < 100,
  HYPERTENSION_CRITICAL:  (v) => v.bloodPressureSystolic >= 180,
  HYPERTENSION_WARNING:   (v) => v.bloodPressureSystolic >= 140,
};

// ─── Symptom Cluster Definitions ─────────────────────────────────────────────

const SYMPTOM_CLUSTERS = {
  respiratory_outbreak: {
    label: "Respiratory Outbreak Cluster",
    required: 2,
    symptoms: ["fever", "cough", "shortness_of_breath", "dry_cough", "chest_pain", "rapid_breathing"],
  },
  covid_signature: {
    label: "COVID-19 Signature Cluster",
    required: 2,
    symptoms: ["loss_of_taste", "loss_of_smell", "dry_cough", "fatigue", "fever"],
  },
  sepsis_cluster: {
    label: "Sepsis Alert Cluster",
    required: 3,
    symptoms: [
      "high_fever_or_hypothermia", "confusion", "rapid_heart_rate",
      "rapid_breathing", "clammy_skin", "extreme_pain",
    ],
  },
  diabetic_cluster: {
    label: "Diabetic / Hyperglycemic Cluster",
    required: 2,
    symptoms: ["frequent_urination", "excessive_thirst", "blurred_vision", "fatigue", "slow_healing_wounds"],
  },
  hepatic_cluster: {
    label: "Hepatic Dysfunction Cluster",
    required: 2,
    symptoms: ["jaundice", "abdominal_pain", "dark_urine", "pale_stools", "easy_bruising", "nausea"],
  },
  renal_cluster: {
    label: "Renal Dysfunction Cluster",
    required: 2,
    symptoms: ["edema", "decreased_urination", "fatigue", "nausea", "confusion"],
  },
  flu_cluster: {
    label: "Influenza Cluster",
    required: 3,
    symptoms: ["fever", "chills", "body_aches", "fatigue", "headache", "sore_throat", "cough"],
  },
};

// ─── Core Rules Engine ────────────────────────────────────────────────────────

/**
 * Evaluates a patient record against all disease rules
 * @param {Object} patient - Validated patient record
 * @returns {Object} Engine evaluation result
 */
export function evaluatePatient(patient) {
  const { vitals, symptoms: { reported }, labResults } = patient;

  const vitalFlags  = evaluateVitalFlags(vitals);
  const labFlags    = evaluateLabFlags(labResults);
  const clusterHits = evaluateSymptomClusters(reported);
  const diseaseMatches = matchDiseases(vitals, reported, labResults);
  const infectiousFlags = checkInfectiousOutbreakCriteria(vitals, reported, labResults);

  return {
    patientId: patient.patientId,
    vitalFlags,
    labFlags,
    clusterHits,
    diseaseMatches,
    infectiousFlags,
    isOutbreakCandidate: infectiousFlags.isFlagged,
    evaluatedAt: new Date().toISOString(),
  };
}

// ─── Vital Flag Evaluation ───────────────────────────────────────────────────

function evaluateVitalFlags(vitals) {
  const flags = [];

  if (VITAL_FLAGS.FEVER_CRITICAL(vitals))
    flags.push({ flag: "fever_critical", label: "Critical Fever", severity: "critical", value: `${vitals.temperatureC}°C`, threshold: "≥39°C" });
  else if (VITAL_FLAGS.FEVER_WARNING(vitals))
    flags.push({ flag: "fever_warning", label: "Fever Warning", severity: "warning", value: `${vitals.temperatureC}°C`, threshold: "≥38°C" });

  if (VITAL_FLAGS.RESP_DISTRESS_CRITICAL(vitals))
    flags.push({ flag: "resp_distress_critical", label: "Respiratory Distress – Critical", severity: "critical", value: `${vitals.spO2}%`, threshold: "<92%" });
  else if (VITAL_FLAGS.RESP_DISTRESS_WARNING(vitals))
    flags.push({ flag: "resp_distress_warning", label: "Respiratory Distress – Warning", severity: "warning", value: `${vitals.spO2}%`, threshold: "<94%" });

  if (VITAL_FLAGS.TACHYCARDIA_CRITICAL(vitals))
    flags.push({ flag: "tachycardia_critical", label: "Tachycardia – Critical", severity: "critical", value: `${vitals.heartRate} bpm`, threshold: "≥120 bpm" });
  else if (VITAL_FLAGS.TACHYCARDIA_WARNING(vitals))
    flags.push({ flag: "tachycardia_warning", label: "Tachycardia – Warning", severity: "warning", value: `${vitals.heartRate} bpm`, threshold: "≥100 bpm" });

  if (VITAL_FLAGS.HYPOTENSION_CRITICAL(vitals))
    flags.push({ flag: "hypotension_critical", label: "Hypotension – Critical", severity: "critical", value: `${vitals.bloodPressureSystolic} mmHg`, threshold: "<90 mmHg" });
  else if (VITAL_FLAGS.HYPOTENSION_WARNING(vitals))
    flags.push({ flag: "hypotension_warning", label: "Hypotension – Warning", severity: "warning", value: `${vitals.bloodPressureSystolic} mmHg`, threshold: "<100 mmHg" });

  if (VITAL_FLAGS.HYPERTENSION_CRITICAL(vitals))
    flags.push({ flag: "hypertension_critical", label: "Hypertension – Critical", severity: "critical", value: `${vitals.bloodPressureSystolic} mmHg`, threshold: "≥180 mmHg" });
  else if (VITAL_FLAGS.HYPERTENSION_WARNING(vitals))
    flags.push({ flag: "hypertension_warning", label: "Hypertension – Warning", severity: "warning", value: `${vitals.bloodPressureSystolic} mmHg`, threshold: "≥140 mmHg" });

  return flags;
}

// ─── Lab Flag Evaluation ─────────────────────────────────────────────────────

function evaluateLabFlags(labs) {
  const flags = [];

  Object.entries(LAB_REFERENCE_RANGES).forEach(([key, ref]) => {
    const value = labs[key];
    if (value === null || value === undefined) return;

    const tooHigh = ref.max !== null && value > ref.max;
    const tooLow  = ref.min !== null && value < ref.min;

    if (tooHigh || tooLow) {
      flags.push({
        marker: key,
        label: ref.name,
        value,
        unit: ref.unit,
        direction: tooHigh ? "elevated" : "low",
        referenceRange: `${ref.min ?? "N/A"}–${ref.max ?? "N/A"} ${ref.unit}`,
        severity: isLabCritical(key, value, ref) ? "critical" : "warning",
      });
    }
  });

  return flags;
}

function isLabCritical(key, value, ref) {
  const criticalThresholds = {
    wbcCount:         { high: 15, low: 2.0 },
    hbA1c:            { high: 9.0, low: null },
    bloodGlucose:     { high: 300, low: 50 },
    liverAlt:         { high: 200, low: null },
    kidneyCreatinine: { high: 3.0, low: null },
    cReactiveProtein: { high: 30, low: null },
    viralLoad:        { high: 1000, low: null },
  };
  const t = criticalThresholds[key];
  if (!t) return false;
  if (t.high !== null && value >= t.high) return true;
  if (t.low !== null && value <= t.low) return true;
  return false;
}

// ─── Symptom Cluster Evaluation ──────────────────────────────────────────────

function evaluateSymptomClusters(reportedSymptoms) {
  const hits = [];
  const reported = new Set(reportedSymptoms.map((s) => s.toLowerCase()));

  Object.entries(SYMPTOM_CLUSTERS).forEach(([clusterId, cluster]) => {
    const matched = cluster.symptoms.filter((s) => reported.has(s));
    if (matched.length >= cluster.required) {
      hits.push({
        clusterId,
        label: cluster.label,
        matchedSymptoms: matched,
        matchCount: matched.length,
        requiredCount: cluster.required,
        confidence: Math.min(1, matched.length / cluster.symptoms.length),
      });
    }
  });

  return hits;
}

// ─── Disease Matching ────────────────────────────────────────────────────────

function matchDiseases(vitals, reportedSymptoms, labs) {
  const reported = new Set(reportedSymptoms.map((s) => s.toLowerCase()));
  const matches = [];

  Object.values(DISEASE_DB).forEach((disease) => {
    const symptomOverlap = disease.primarySymptoms.filter((s) => reported.has(s));
    const symptomScore = symptomOverlap.length / disease.primarySymptoms.length;

    // Lab criteria match
    let labCriteriaScore = 0;
    let labCriteriaHits = 0;
    const labKeys = Object.keys(disease.criticalLabBoundaries);
    labKeys.forEach((labKey) => {
      const threshold = disease.criticalLabBoundaries[labKey];
      const value = labs[labKey];
      if (value === null || value === undefined) return;
      const exceedsMin = threshold.min !== null && value >= threshold.min;
      const exceedsMax = threshold.max !== null && value <= threshold.max;
      if (exceedsMin || exceedsMax) {
        labCriteriaHits++;
      }
    });
    if (labKeys.length > 0) labCriteriaScore = labCriteriaHits / labKeys.length;

    // Vital threshold breach
    let vitalScore = 0;
    const vitalKeys = Object.keys(disease.vitalThresholds);
    let vitalHits = 0;
    vitalKeys.forEach((vKey) => {
      const threshold = disease.vitalThresholds[vKey];
      const val = vitals[vKey];
      if (val === undefined) return;
      if (threshold.critical !== undefined) {
        if (vKey === "spO2" || vKey === "bloodPressureSystolic") {
          if (val <= threshold.critical) vitalHits++;
          else if (val <= threshold.warning) vitalHits += 0.5;
        } else {
          if (val >= threshold.critical) vitalHits++;
          else if (val >= threshold.warning) vitalHits += 0.5;
        }
      }
    });
    if (vitalKeys.length > 0) vitalScore = vitalHits / vitalKeys.length;

    // Composite match score
    const compositeScore = (symptomScore * 0.45) + (labCriteriaScore * 0.35) + (vitalScore * 0.20);

    if (compositeScore > 0.15 || symptomOverlap.length >= 2) {
      matches.push({
        diseaseId: disease.id,
        diseaseName: disease.name,
        type: disease.type,
        compositeScore: parseFloat(compositeScore.toFixed(3)),
        symptomOverlap,
        symptomScore: parseFloat(symptomScore.toFixed(3)),
        labCriteriaScore: parseFloat(labCriteriaScore.toFixed(3)),
        vitalScore: parseFloat(vitalScore.toFixed(3)),
        icdCode: disease.icdCode,
        quarantineProtocol: disease.quarantineProtocol,
        treatmentProtocol: disease.treatmentProtocol,
      });
    }
  });

  // Sort by composite score descending
  matches.sort((a, b) => b.compositeScore - a.compositeScore);
  return matches;
}

// ─── Infectious Outbreak Check ───────────────────────────────────────────────

function checkInfectiousOutbreakCriteria(vitals, reportedSymptoms, labs) {
  const flags = [];

  const hasFever = vitals.temperatureC >= 38.0;
  const hasRespDistress = vitals.spO2 < 92;
  const hasHighViralLoad = labs.viralLoad !== null && labs.viralLoad >= 1000;
  const hasHighCRP = labs.cReactiveProtein !== null && labs.cReactiveProtein > 10;

  const reported = new Set(reportedSymptoms.map((s) => s.toLowerCase()));
  const suddenOnsetSymptoms = ["fever", "chills", "rapid_breathing", "shortness_of_breath", "confusion"];
  const suddenOnsetCount = suddenOnsetSymptoms.filter((s) => reported.has(s)).length;

  if (hasFever && hasRespDistress) {
    flags.push({
      type: "infectious_critical",
      label: "Fever + Respiratory Distress",
      detail: `Temp ${vitals.temperatureC}°C + SpO2 ${vitals.spO2}%`,
    });
  }

  if (hasFever && suddenOnsetCount >= 2) {
    flags.push({
      type: "sudden_onset_cluster",
      label: "Sudden-Onset Symptom Cluster",
      detail: `${suddenOnsetCount} sudden-onset indicators with fever`,
    });
  }

  if (hasHighViralLoad) {
    flags.push({
      type: "high_viral_load",
      label: "High Viral Load Detected",
      detail: `Viral load: ${labs.viralLoad} copies/mL`,
    });
  }

  if (hasHighCRP) {
    flags.push({
      type: "elevated_crp",
      label: "Elevated CRP – Systemic Inflammation",
      detail: `CRP: ${labs.cReactiveProtein} mg/L`,
    });
  }

  return {
    isFlagged: flags.length > 0,
    flags,
  };
}

// ─── Batch Evaluation ────────────────────────────────────────────────────────

/**
 * Runs the rules engine over a full patient dataset
 * @param {Array} patients - Array of validated patient records
 * @returns {Array} Array of engine evaluation results
 */
export function evaluatePatientBatch(patients) {
  return patients.map(evaluatePatient);
}
