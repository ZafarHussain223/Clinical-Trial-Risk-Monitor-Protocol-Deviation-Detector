/**
 * Epidemiological & Regional Risk Scoring Module
 * Cluster/velocity tracking, outbreak risk scoring, and containment triggers
 */

// ─── Constants ───────────────────────────────────────────────────────────────

export const TRAILING_WINDOW_DAYS = 14;
export const OUTBREAK_TRIGGER_THRESHOLD = 70;      // Score ≥70 triggers public health alert
export const GROWTH_VELOCITY_WINDOW_DAYS = 7;      // Compare last 7d vs prior 7d for velocity

// ─── Regional Aggregation ─────────────────────────────────────────────────────

/**
 * Aggregates patient and triage data into regional buckets for the trailing 14-day window
 * @param {Array} patients - Validated patient records
 * @param {Array} triageResults - Parallel triage classification results
 * @returns {Object} regionId → aggregated region data
 */
export function aggregateByRegion(patients, triageResults) {
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(now.getDate() - TRAILING_WINDOW_DAYS);

  const regionMap = {};

  patients.forEach((patient, i) => {
    const triage = triageResults[i];
    const region = patient.demographics.region;
    const zipCode = patient.demographics.zipCode;
    const onsetDate = new Date(patient.symptoms.onsetDate);

    // Only include cases within the trailing 14-day window
    if (onsetDate < windowStart) return;

    if (!regionMap[region]) {
      regionMap[region] = {
        regionId: region,
        zipCodes: new Set(),
        totalCases: 0,
        casesByDay: {},
        severityCounts: { critical: 0, moderate: 0, low: 0 },
        infectiousCases: 0,
        outbreakCandidates: 0,
        patients: [],
      };
    }

    const r = regionMap[region];
    r.zipCodes.add(zipCode);
    r.totalCases++;
    r.patients.push({ patientId: patient.patientId, severity: triage.severity, score: triage.severityScore, onsetDate: patient.symptoms.onsetDate });
    r.severityCounts[triage.severity]++;

    if (triage.actions.contactTracing || triage.actions.publicHealthReport) r.outbreakCandidates++;

    // Daily case accumulation
    const dayKey = patient.symptoms.onsetDate.split("T")[0];
    r.casesByDay[dayKey] = (r.casesByDay[dayKey] || 0) + 1;
  });

  // Finalize: convert Sets to arrays
  Object.values(regionMap).forEach((r) => {
    r.zipCodes = Array.from(r.zipCodes);
  });

  return regionMap;
}

// ─── Growth Velocity Calculation ─────────────────────────────────────────────

/**
 * Computes the 7-day growth velocity ratio for a region
 * Ratio > 1 means growth; < 1 means decline; = 1 means flat
 * @param {Object} casesByDay - { "YYYY-MM-DD": caseCount }
 * @returns {Object} velocity data
 */
export function computeGrowthVelocity(casesByDay) {
  const today = new Date();

  let last7 = 0;
  let prior7 = 0;

  Object.entries(casesByDay).forEach(([dateStr, count]) => {
    const d = new Date(dateStr);
    const daysAgo = Math.floor((today - d) / (1000 * 60 * 60 * 24));
    if (daysAgo < 7) last7 += count;
    else if (daysAgo < 14) prior7 += count;
  });

  const velocityRatio = prior7 === 0
    ? (last7 > 0 ? 3.0 : 1.0)
    : parseFloat((last7 / prior7).toFixed(3));

  const trend = velocityRatio > 1.5 ? "surging"
    : velocityRatio > 1.1 ? "rising"
    : velocityRatio < 0.7 ? "declining"
    : "stable";

  return {
    last7DayCases: last7,
    prior7DayCases: prior7,
    velocityRatio,
    trend,
  };
}

// ─── Outbreak Risk Score ──────────────────────────────────────────────────────

/**
 * Computes regional outbreak risk score (0–100)
 * Formula components:
 *   (1) Case incidence rate weighted by region size (0–30 pts)
 *   (2) Growth velocity (0–40 pts)
 *   (3) Severe case percentage (0–30 pts)
 *
 * @param {Object} regionData - Aggregated region bucket
 * @param {number} estimatedPopulation - Approximate regional population for rate calc
 * @returns {Object} Risk score details
 */
export function computeOutbreakRiskScore(regionData, estimatedPopulation = 50000) {
  const velocity = computeGrowthVelocity(regionData.casesByDay);
  const totalCases = regionData.totalCases;
  const severityCounts = regionData.severityCounts;

  // ── Component 1: Incidence Rate ───────────────────────────────────────────
  // Cases per 100,000 in trailing 14 days
  const incidenceRate = (totalCases / estimatedPopulation) * 100000;
  let incidenceScore;
  if (incidenceRate >= 500)     incidenceScore = 30;
  else if (incidenceRate >= 200) incidenceScore = 22;
  else if (incidenceRate >= 100) incidenceScore = 16;
  else if (incidenceRate >= 50)  incidenceScore = 10;
  else if (incidenceRate >= 20)  incidenceScore = 5;
  else                           incidenceScore = Math.round((incidenceRate / 20) * 5);

  // ── Component 2: Growth Velocity ─────────────────────────────────────────
  let velocityScore;
  const vr = velocity.velocityRatio;
  if (vr >= 3.0)      velocityScore = 40;
  else if (vr >= 2.0) velocityScore = 30;
  else if (vr >= 1.5) velocityScore = 22;
  else if (vr >= 1.2) velocityScore = 15;
  else if (vr >= 1.0) velocityScore = 8;
  else                velocityScore = Math.max(0, Math.round((vr / 1.0) * 8));

  // ── Component 3: Severity Composition ────────────────────────────────────
  const criticalPct = totalCases > 0 ? severityCounts.critical / totalCases : 0;
  let severityScore;
  if (criticalPct >= 0.50)      severityScore = 30;
  else if (criticalPct >= 0.35) severityScore = 22;
  else if (criticalPct >= 0.20) severityScore = 15;
  else if (criticalPct >= 0.10) severityScore = 8;
  else                          severityScore = Math.round(criticalPct * 80);

  const rawScore = incidenceScore + velocityScore + severityScore;
  const riskScore = Math.min(100, Math.max(0, rawScore));

  const riskLevel = riskScore >= 70 ? "HIGH"
    : riskScore >= 40 ? "MODERATE"
    : "LOW";

  return {
    riskScore,
    riskLevel,
    components: {
      incidenceScore,
      velocityScore,
      severityScore,
      incidenceRate: parseFloat(incidenceRate.toFixed(1)),
    },
    velocity,
    criticalCasePercentage: parseFloat((criticalPct * 100).toFixed(1)),
    outbreakTriggered: riskScore >= OUTBREAK_TRIGGER_THRESHOLD,
  };
}

// ─── Containment Trigger System ──────────────────────────────────────────────

/**
 * Evaluates whether a region qualifies for automated containment triggers
 * and returns the appropriate action set
 * @param {string} regionId
 * @param {Object} riskResult - Output from computeOutbreakRiskScore()
 * @param {Object} regionData - Aggregated region bucket
 * @returns {Object} Containment action plan
 */
export function evaluateContainmentTriggers(regionId, riskResult, regionData) {
  if (!riskResult.outbreakTriggered) {
    return {
      triggered: false,
      regionId,
      riskScore: riskResult.riskScore,
      actions: [],
    };
  }

  const actions = [
    {
      type: "public_health_alert",
      label: "🚨 Public Health Alert Issued",
      detail: `Regional outbreak risk score: ${riskResult.riskScore}/100 — Region: ${regionId}`,
      priority: "IMMEDIATE",
    },
    {
      type: "clinic_flag",
      label: "🏥 Local Clinic Network Flagged",
      detail: `All clinics in ${regionId} (ZIP: ${regionData.zipCodes.join(", ")}) placed on outbreak watch`,
      priority: "IMMEDIATE",
    },
    {
      type: "contact_tracing",
      label: "🔍 Contact-Tracing Workflow Initiated",
      detail: `${regionData.outbreakCandidates} high-risk patients identified for contact investigation`,
      priority: "URGENT",
    },
    {
      type: "supply_pre_positioning",
      label: "📦 Medical Supply Pre-Positioning Request",
      detail: `Additional PPE and treatment supplies flagged for ${regionId}`,
      priority: "HIGH",
    },
  ];

  if (riskResult.riskScore >= 85) {
    actions.push({
      type: "mass_notification",
      label: "📢 Community Mass Notification",
      detail: `Risk score ≥85 — Community-wide advisory and isolation guidance broadcast`,
      priority: "IMMEDIATE",
    });
  }

  return {
    triggered: true,
    regionId,
    riskScore: riskResult.riskScore,
    riskLevel: riskResult.riskLevel,
    triggeredAt: new Date().toISOString(),
    actions,
  };
}

// ─── Full Regional Analysis Pipeline ─────────────────────────────────────────

/**
 * Runs the complete regional epidemiological analysis pipeline
 * @param {Array} patients - Validated patient records
 * @param {Array} triageResults - Parallel triage results
 * @param {Object} populationMap - { regionId: estimatedPopulation }
 * @returns {Array} Full regional analysis results
 */
export function runRegionalAnalysis(patients, triageResults, populationMap = {}) {
  const regionMap = aggregateByRegion(patients, triageResults);
  const analysisResults = [];

  Object.entries(regionMap).forEach(([regionId, regionData]) => {
    const population = populationMap[regionId] || 50000;
    const riskResult = computeOutbreakRiskScore(regionData, population);
    const containment = evaluateContainmentTriggers(regionId, riskResult, regionData);

    analysisResults.push({
      regionId,
      zipCodes: regionData.zipCodes,
      totalCases: regionData.totalCases,
      severityCounts: regionData.severityCounts,
      casesByDay: regionData.casesByDay,
      riskScore: riskResult.riskScore,
      riskLevel: riskResult.riskLevel,
      riskComponents: riskResult.components,
      velocity: riskResult.velocity,
      criticalCasePercentage: riskResult.criticalCasePercentage,
      outbreakTriggered: riskResult.outbreakTriggered,
      containmentActions: containment.actions,
      patients: regionData.patients,
    });
  });

  // Sort by risk score descending
  analysisResults.sort((a, b) => b.riskScore - a.riskScore);
  return analysisResults;
}
