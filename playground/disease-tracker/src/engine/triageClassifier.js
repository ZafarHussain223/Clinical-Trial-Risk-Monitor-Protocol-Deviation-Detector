/**
 * Triage & Severity Classification Engine
 * Clinical Risk Grading: Critical / Moderate / Low
 */

// ─── Severity Level Constants ────────────────────────────────────────────────

export const SEVERITY = {
  CRITICAL: "critical",
  MODERATE: "moderate",
  LOW:      "low",
};

export const SEVERITY_LABELS = {
  critical: "Critical / High Risk",
  moderate: "Moderate Risk",
  low:      "Low Risk / Mild",
};

export const SEVERITY_COLORS = {
  critical: "#dc2626", // Red
  moderate: "#d97706", // Amber
  low:      "#16a34a", // Green
};

// ─── Scoring Weights ─────────────────────────────────────────────────────────

const VITAL_SCORE_WEIGHTS = {
  // SpO2 scoring (inverted — lower is worse)
  spO2: (v) => {
    if (v < 88) return 40;
    if (v < 90) return 30;
    if (v < 92) return 20;
    if (v < 94) return 10;
    return 0;
  },
  // Temperature scoring
  temperatureC: (v) => {
    if (v >= 40.0) return 30;
    if (v >= 39.5) return 20;
    if (v >= 39.0) return 15;
    if (v >= 38.5) return 10;
    if (v >= 38.0) return 5;
    return 0;
  },
  // Heart rate scoring
  heartRate: (v) => {
    if (v >= 130) return 20;
    if (v >= 120) return 15;
    if (v >= 110) return 10;
    if (v >= 100) return 5;
    return 0;
  },
  // Systolic BP scoring (both too low and too high are dangerous)
  bloodPressureSystolic: (v) => {
    if (v < 80) return 30;
    if (v < 90) return 20;
    if (v < 100) return 10;
    if (v >= 180) return 20;
    if (v >= 160) return 10;
    if (v >= 140) return 5;
    return 0;
  },
};

const LAB_SCORE_WEIGHTS = {
  spO2:             (v) => (v < 92 ? 20 : v < 94 ? 10 : 0),
  wbcCount:         (v) => (v > 15 || v < 2 ? 15 : v > 12 || v < 3.5 ? 8 : 0),
  cReactiveProtein: (v) => (v > 30 ? 15 : v > 20 ? 10 : v > 10 ? 5 : 0),
  kidneyCreatinine: (v) => (v > 3.0 ? 15 : v > 2.0 ? 10 : v > 1.3 ? 5 : 0),
  hbA1c:            (v) => (v > 9.0 ? 12 : v > 7.5 ? 7 : v >= 6.5 ? 3 : 0),
  bloodGlucose:     (v) => (v > 400 ? 15 : v > 300 ? 10 : v > 200 ? 5 : 0),
  liverAlt:         (v) => (v > 200 ? 10 : v > 100 ? 6 : v > 56 ? 3 : 0),
  viralLoad:        (v) => (v > 10000 ? 15 : v > 1000 ? 8 : 0),
};

const PRE_EXISTING_CONDITION_MULTIPLIERS = {
  heart_failure: 1.25,
  COPD:          1.20,
  CKD:           1.20,
  diabetes:      1.15,
  hypertension:  1.10,
  obesity:       1.10,
  immunodeficiency: 1.30,
  cancer:        1.25,
};

// ─── Severity Classifier ─────────────────────────────────────────────────────

/**
 * Classifies patient severity and generates triage action plan
 * @param {Object} patient - Validated patient record
 * @param {Object} engineResult - Output from rulesEngine.evaluatePatient()
 * @returns {Object} Triage classification result
 */
export function classifySeverity(patient, engineResult) {
  let score = 0;

  // 1. Vital signs scoring
  const vitals = patient.vitals;
  Object.entries(VITAL_SCORE_WEIGHTS).forEach(([key, fn]) => {
    if (vitals[key] !== undefined && vitals[key] !== null) {
      score += fn(vitals[key]);
    }
  });

  // 2. Lab results scoring
  const labs = patient.labResults;
  Object.entries(LAB_SCORE_WEIGHTS).forEach(([key, fn]) => {
    if (labs[key] !== null && labs[key] !== undefined) {
      score += fn(labs[key]);
    }
  });

  // 3. Critical vital flag bonus
  const criticalVitalFlags = engineResult.vitalFlags.filter((f) => f.severity === "critical");
  score += criticalVitalFlags.length * 10;

  // 4. Critical lab flag bonus
  const criticalLabFlags = engineResult.labFlags.filter((f) => f.severity === "critical");
  score += criticalLabFlags.length * 8;

  // 5. Infectious outbreak candidate bonus
  if (engineResult.isOutbreakCandidate) score += 15;

  // 6. Top disease match score boost
  if (engineResult.diseaseMatches.length > 0) {
    const topMatch = engineResult.diseaseMatches[0];
    score += Math.round(topMatch.compositeScore * 20);
    if (topMatch.type === "critical_infectious") score += 20;
  }

  // 7. Symptom cluster bonus
  score += Math.min(engineResult.clusterHits.length * 5, 15);

  // 8. Pre-existing condition multiplier
  let multiplier = 1.0;
  patient.preExistingConditions.forEach((condition) => {
    const m = PRE_EXISTING_CONDITION_MULTIPLIERS[condition];
    if (m) multiplier = Math.max(multiplier, m);
  });
  score = Math.round(score * multiplier);

  // 9. Age adjustment
  if (patient.demographics.age >= 70) score += 10;
  else if (patient.demographics.age >= 60) score += 5;

  score = Math.min(100, score);

  const severity = score >= 65 ? SEVERITY.CRITICAL
    : score >= 35 ? SEVERITY.MODERATE
    : SEVERITY.LOW;

  const actions = generateActions(severity, patient, engineResult);
  const topDisease = engineResult.diseaseMatches[0] ?? null;

  return {
    patientId: patient.patientId,
    severityScore: score,
    severity,
    severityLabel: SEVERITY_LABELS[severity],
    severityColor: SEVERITY_COLORS[severity],
    primarySuspectedDisease: topDisease
      ? { id: topDisease.diseaseId, name: topDisease.diseaseName, icdCode: topDisease.icdCode }
      : null,
    criticalVitalFlags,
    criticalLabFlags,
    actions,
    classifiedAt: new Date().toISOString(),
  };
}

// ─── Action Plan Generator ───────────────────────────────────────────────────

function generateActions(severity, patient, engineResult) {
  const topDisease = engineResult.diseaseMatches[0];

  if (severity === SEVERITY.CRITICAL) {
    return {
      immediateActions: [
        "🚨 IMMEDIATE: Hospital / ICU triage alert dispatched",
        "📟 Automated physician notification sent",
        "🔴 Emergency contact for patient activated",
        topDisease?.quarantineProtocol
          ? `🔒 Isolation Protocol: ${topDisease.quarantineProtocol}`
          : "🔒 Standard infectious isolation protocol initiated",
      ],
      diagnosticOrders: [
        "Complete Blood Count (CBC) with differential",
        "Comprehensive Metabolic Panel (CMP)",
        "Blood cultures × 2",
        "Chest X-Ray / CT scan if respiratory involvement",
        "Procalcitonin, Lactate",
        ...(engineResult.isOutbreakCandidate ? ["Respiratory pathogen panel (PCR)", "COVID-19 NAAT test"] : []),
      ],
      monitoringPlan: "Continuous vital sign monitoring q15min; ICU telemetry",
      treatmentGuidance: topDisease?.treatmentProtocol ?? "Immediate supportive care; specialist consult",
      contactTracing: engineResult.isOutbreakCandidate,
      publicHealthReport: engineResult.isOutbreakCandidate,
    };
  }

  if (severity === SEVERITY.MODERATE) {
    return {
      immediateActions: [
        "📅 Priority appointment scheduled within 24 hours",
        "🧪 Diagnostic lab order generated",
        "📊 Clinical monitoring protocol activated",
        topDisease?.quarantineProtocol
          ? `ℹ️ Precaution: ${topDisease.quarantineProtocol}`
          : "ℹ️ Standard precautions advised",
      ],
      diagnosticOrders: [
        "CBC with differential",
        "Basic Metabolic Panel",
        ...(engineResult.labFlags.some((f) => f.marker === "hbA1c") ? ["HbA1c repeat test", "Glucose tolerance test"] : []),
        ...(engineResult.labFlags.some((f) => f.marker === "liverAlt") ? ["Liver function panel", "Hepatitis B/C serology"] : []),
        ...(engineResult.isOutbreakCandidate ? ["Respiratory pathogen PCR", "COVID-19 antigen test"] : []),
      ],
      monitoringPlan: "Vitals re-check in 6 hours; daily telehealth check-in",
      treatmentGuidance: topDisease?.treatmentProtocol ?? "Symptomatic management; clinical review within 24h",
      contactTracing: engineResult.infectiousFlags.flags.some((f) => f.type === "high_viral_load"),
      publicHealthReport: false,
    };
  }

  // LOW severity
  return {
    immediateActions: [
      "📋 Auto-generated patient care instructions sent",
      "📱 Daily digital check-in reminder scheduled",
      "💊 OTC symptom management guidance provided",
    ],
    diagnosticOrders: [
      ...(engineResult.labFlags.length > 0 ? ["Routine follow-up labs based on flags"] : []),
    ],
    monitoringPlan: "Patient self-monitoring with digital check-in; escalate if symptoms worsen",
    treatmentGuidance: topDisease?.treatmentProtocol ?? "Rest, hydration, OTC medication as appropriate; re-evaluate if no improvement in 5 days",
    contactTracing: false,
    publicHealthReport: false,
  };
}

// ─── Batch Classification ────────────────────────────────────────────────────

/**
 * Classifies severity for an entire patient batch
 * @param {Array} patients - Array of validated patient records
 * @param {Array} engineResults - Parallel array of rules engine results
 * @returns {Array} Array of triage classification results
 */
export function classifyPatientBatch(patients, engineResults) {
  return patients.map((patient, i) => classifySeverity(patient, engineResults[i]));
}

// ─── Summary Stats ───────────────────────────────────────────────────────────

/**
 * Aggregates triage results into summary statistics
 * @param {Array} triageResults - Array of triage classification results
 * @returns {Object} Summary statistics
 */
export function computeTriageSummary(triageResults) {
  const counts = { critical: 0, moderate: 0, low: 0 };
  let totalScore = 0;
  let outbreakCandidates = 0;

  triageResults.forEach((r) => {
    counts[r.severity]++;
    totalScore += r.severityScore;
    if (r.actions.contactTracing) outbreakCandidates++;
  });

  return {
    total: triageResults.length,
    bySeverity: counts,
    averageScore: triageResults.length > 0 ? Math.round(totalScore / triageResults.length) : 0,
    outbreakCandidates,
    criticalPercentage: triageResults.length > 0
      ? parseFloat(((counts.critical / triageResults.length) * 100).toFixed(1))
      : 0,
  };
}
