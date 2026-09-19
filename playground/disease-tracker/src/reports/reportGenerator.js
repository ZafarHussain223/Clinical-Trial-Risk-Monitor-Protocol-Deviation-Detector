/**
 * Clinical Summary & Public Health Report Generator
 * Exports standardized epidemiological case logs and patient summaries
 */

// ─── Patient Clinical Summary ─────────────────────────────────────────────────

/**
 * Generates a standardized clinical summary for a single patient
 */
export function generatePatientClinicalSummary(patient, engineResult, triageResult) {
  const now = new Date().toISOString();

  return {
    reportType: "PATIENT_CLINICAL_SUMMARY",
    generatedAt: now,
    patientId: patient.patientId,
    demographics: {
      age: patient.demographics.age,
      gender: patient.demographics.gender,
      region: patient.demographics.region,
      zipCode: patient.demographics.zipCode,
    },
    clinicalPresentation: {
      onsetDate: patient.symptoms.onsetDate,
      reportedSymptoms: patient.symptoms.reported,
      vitals: {
        temperature: `${patient.vitals.temperatureC}°C / ${patient.vitals.temperatureF}°F`,
        bloodPressure: `${patient.vitals.bloodPressureSystolic}/${patient.vitals.bloodPressureDiastolic} mmHg`,
        spO2: `${patient.vitals.spO2}%`,
        heartRate: `${patient.vitals.heartRate} bpm`,
      },
      preExistingConditions: patient.preExistingConditions,
    },
    labFindings: Object.entries(patient.labResults)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([key, value]) => ({ marker: key, value })),
    ruleEngineFlags: {
      vitalFlags: engineResult.vitalFlags,
      labFlags: engineResult.labFlags,
      clusterHits: engineResult.clusterHits.map((c) => c.label),
      isOutbreakCandidate: engineResult.isOutbreakCandidate,
    },
    diagnosis: {
      severityScore: triageResult.severityScore,
      severityLevel: triageResult.severityLabel,
      primarySuspectedDisease: triageResult.primarySuspectedDisease,
      topDifferentials: engineResult.diseaseMatches.slice(0, 3).map((m) => ({
        disease: m.diseaseName,
        icdCode: m.icdCode,
        matchScore: (m.compositeScore * 100).toFixed(0) + "%",
      })),
    },
    clinicalActionPlan: triageResult.actions,
    icdCodes: engineResult.diseaseMatches.slice(0, 3).map((m) => m.icdCode),
  };
}

// ─── Public Health Epidemiological Export ─────────────────────────────────────

/**
 * Generates a regional epidemiological case log for public health reporting
 */
export function generatePublicHealthReport(patients, triageResults, engineResults, regionalAnalysis) {
  const now = new Date().toISOString();
  const criticalCount = triageResults.filter((t) => t.severity === "critical").length;
  const moderateCount = triageResults.filter((t) => t.severity === "moderate").length;
  const lowCount = triageResults.filter((t) => t.severity === "low").length;
  const outbreakRegions = regionalAnalysis.filter((r) => r.outbreakTriggered);

  return {
    reportType: "PUBLIC_HEALTH_EPIDEMIOLOGICAL_EXPORT",
    generatedAt: now,
    reportingPeriod: "Trailing 14 days",
    summary: {
      totalMonitoredPatients: patients.length,
      criticalCases: criticalCount,
      moderateCases: moderateCount,
      lowRiskCases: lowCount,
      activeOutbreakRegions: outbreakRegions.length,
      outbreakRegionNames: outbreakRegions.map((r) => r.regionId),
    },
    regionalBreakdown: regionalAnalysis.map((r) => ({
      region: r.regionId,
      zipCodes: r.zipCodes,
      totalCases: r.totalCases,
      riskScore: r.riskScore,
      riskLevel: r.riskLevel,
      growthTrend: r.velocity.trend,
      velocityRatio: r.velocity.velocityRatio,
      criticalCasePercentage: r.criticalCasePercentage,
      outbreakTriggered: r.outbreakTriggered,
      containmentActionsCount: r.containmentActions.length,
    })),
    caseSummaryLog: patients.map((p, i) => ({
      patientId: p.patientId,
      age: p.demographics.age,
      region: p.demographics.region,
      onsetDate: p.symptoms.onsetDate,
      severity: triageResults[i].severity,
      severityScore: triageResults[i].severityScore,
      primaryDisease: triageResults[i].primarySuspectedDisease?.name ?? "Undetermined",
      icdCode: triageResults[i].primarySuspectedDisease?.icdCode ?? "N/A",
      isOutbreakCandidate: engineResults[i].isOutbreakCandidate,
    })),
    icdCodeFrequency: computeIcdFrequency(triageResults),
    containmentActions: outbreakRegions.flatMap((r) => r.containmentActions.map((a) => ({
      region: r.regionId,
      ...a,
    }))),
  };
}

function computeIcdFrequency(triageResults) {
  const freq = {};
  triageResults.forEach((t) => {
    if (t.primarySuspectedDisease) {
      const code = t.primarySuspectedDisease.icdCode;
      if (!freq[code]) freq[code] = { icdCode: code, name: t.primarySuspectedDisease.name, count: 0 };
      freq[code].count++;
    }
  });
  return Object.values(freq).sort((a, b) => b.count - a.count);
}
