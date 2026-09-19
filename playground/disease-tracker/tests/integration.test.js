/**
 * End-to-End Integration Test Suite
 * Validates all platform modules against known expected outputs
 */

import { createPatientRecord, DISEASE_DB, LAB_REFERENCE_RANGES } from "../src/data/schema.js";
import { evaluatePatient, evaluatePatientBatch } from "../src/engine/rulesEngine.js";
import { classifySeverity, classifyPatientBatch, computeTriageSummary, SEVERITY } from "../src/engine/triageClassifier.js";
import { aggregateByRegion, computeGrowthVelocity, computeOutbreakRiskScore, runRegionalAnalysis } from "../src/engine/epidemiology.js";
import { SAMPLE_PATIENTS } from "../src/data/samplePatients.js";
import { runPipeline, PLATFORM_STATE } from "../src/pipeline.js";

// ── Test helpers ─────────────────────────────────────────────────────────────

let passed = 0, failed = 0;

function assert(condition, description) {
  if (condition) {
    console.log(`  ✅ ${description}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${description}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("═".repeat(60));
}

// ── Test 1: Schema & Ingestion ────────────────────────────────────────────────

section("TEST 1: Data Schema & Ingestion");

const raw = {
  patientId: "PT-TEST-1",
  age: 55, gender: "M", zipCode: "90210", region: "Test Region",
  preExistingConditions: ["hypertension"],
  temperatureC: 39.2,
  bloodPressureSystolic: 155, bloodPressureDiastolic: 95,
  spO2: 93, heartRate: 108,
  onsetDate: "2025-01-10",
  symptoms: ["fever", "cough", "fatigue"],
  wbcCount: 13.5, cReactiveProtein: 18,
  hbA1c: null, viralLoad: null, bloodGlucose: null, liverAlt: null, kidneyCreatinine: null,
};

const patient = createPatientRecord(raw);

assert(patient.patientId === "PT-TEST-1", "Patient ID preserved");
assert(patient.demographics.age === 55, "Age correctly ingested");
assert(patient.vitals.temperatureC === 39.2, "Temperature stored in Celsius");
assert(patient.vitals.temperatureF === 102.6, "Temperature converted to Fahrenheit correctly");
assert(patient.vitals.spO2 === 93, "SpO2 stored correctly");
assert(Array.isArray(patient.symptoms.reported), "Symptoms stored as array");
assert(patient.symptoms.reported.includes("fever"), "Symptom 'fever' ingested");
assert(patient.preExistingConditions.includes("hypertension"), "Pre-existing conditions stored");
assert(patient.labResults.wbcCount === 13.5, "WBC count stored");
assert(patient.labResults.hbA1c === null, "Null lab values handled gracefully");
assert(Object.keys(DISEASE_DB).length >= 7, "Disease reference DB has ≥7 entries");
assert("covid19" in DISEASE_DB, "COVID-19 entry present in disease DB");
assert("sepsis" in DISEASE_DB, "Sepsis entry present in disease DB");
assert(Object.keys(LAB_REFERENCE_RANGES).length >= 6, "Lab reference ranges defined");

// ── Test 2: Rules Engine ─────────────────────────────────────────────────────

section("TEST 2: Automated Rules Engine");

const engineResult = evaluatePatient(patient);

assert(engineResult.patientId === "PT-TEST-1", "Engine returns correct patient ID");
assert(Array.isArray(engineResult.vitalFlags), "Vital flags array returned");
assert(engineResult.vitalFlags.some((f) => f.severity === "critical"), "Critical vital flag detected for high fever");
assert(engineResult.vitalFlags.some((f) => f.flag === "fever_critical"), "Fever critical flag fired (39.2°C ≥ 39°C)");
assert(engineResult.vitalFlags.some((f) => f.flag === "tachycardia_warning"), "Tachycardia warning fired (108 bpm ≥ 100)");
assert(engineResult.vitalFlags.some((f) => f.flag === "hypertension_warning"), "Hypertension warning fired (155 mmHg ≥ 140)");
assert(Array.isArray(engineResult.labFlags), "Lab flags array returned");
assert(engineResult.labFlags.some((f) => f.marker === "wbcCount"), "Elevated WBC flagged (13.5 > 11 ref max)");
assert(engineResult.labFlags.some((f) => f.marker === "cReactiveProtein"), "Elevated CRP flagged (18 > 3 ref max)");
assert(Array.isArray(engineResult.diseaseMatches), "Disease matches array returned");
assert(engineResult.diseaseMatches.length > 0, "At least one disease match found");
assert(engineResult.diseaseMatches[0].compositeScore > 0, "Top match has positive composite score");
assert(typeof engineResult.isOutbreakCandidate === "boolean", "Outbreak candidate flag is boolean");

// Test respiratory distress case
const criticalRaw = {
  patientId: "PT-TEST-CRIT",
  age: 70, gender: "M", zipCode: "10001", region: "Test",
  preExistingConditions: ["COPD"],
  temperatureC: 39.6, bloodPressureSystolic: 85, bloodPressureDiastolic: 50,
  spO2: 88, heartRate: 132,
  onsetDate: "2025-01-10", symptoms: ["high_fever_or_hypothermia", "shortness_of_breath", "confusion"],
  wbcCount: 16, cReactiveProtein: 35, viralLoad: null, hbA1c: null, bloodGlucose: null, liverAlt: null, kidneyCreatinine: null,
};
const critPatient = createPatientRecord(criticalRaw);
const critEngine  = evaluatePatient(critPatient);

assert(critEngine.vitalFlags.some((f) => f.flag === "resp_distress_critical"), "SpO2 88% → respiratory distress critical flag");
assert(critEngine.vitalFlags.some((f) => f.flag === "hypotension_critical"), "BP 85 → hypotension critical flag");
assert(critEngine.isOutbreakCandidate === true, "Fever + resp distress → outbreak candidate");
assert(critEngine.infectiousFlags.flags.some((f) => f.type === "infectious_critical"), "Infectious critical flag fired");

// Test low-risk case
const lowRaw = {
  patientId: "PT-TEST-LOW",
  age: 28, gender: "F", zipCode: "10005", region: "Test",
  preExistingConditions: [],
  temperatureC: 37.8, bloodPressureSystolic: 118, bloodPressureDiastolic: 76,
  spO2: 98, heartRate: 80,
  onsetDate: "2025-01-10", symptoms: ["sore_throat", "mild_headache"],
  wbcCount: 6.5, cReactiveProtein: 2.1, viralLoad: null, hbA1c: null, bloodGlucose: null, liverAlt: null, kidneyCreatinine: null,
};
const lowPatient = createPatientRecord(lowRaw);
const lowEngine  = evaluatePatient(lowPatient);

assert(!lowEngine.isOutbreakCandidate, "Low-risk patient not flagged as outbreak candidate");
assert(lowEngine.vitalFlags.filter((f) => f.severity === "critical").length === 0, "No critical vital flags for low-risk patient");

// ── Test 3: Triage Classifier ────────────────────────────────────────────────

section("TEST 3: Triage & Severity Classification");

const triageCrit = classifySeverity(critPatient, critEngine);
const triageLow  = classifySeverity(lowPatient, lowEngine);
const triageMod  = classifySeverity(patient, engineResult);

assert(triageCrit.severity === SEVERITY.CRITICAL, "Critical patient classified as CRITICAL");
assert(triageCrit.severityScore >= 65, `Critical score ≥65 (got ${triageCrit.severityScore})`);
assert(triageLow.severity === SEVERITY.LOW, `Low-risk patient classified as LOW (score: ${triageLow.severityScore})`);
assert(triageLow.severityScore < 35, `Low score <35 (got ${triageLow.severityScore})`);
assert(["critical","moderate","low"].includes(triageMod.severity), "Moderate patient gets valid severity level");

// Action plan validation
assert(Array.isArray(triageCrit.actions.immediateActions), "Critical patient has immediate actions array");
assert(triageCrit.actions.immediateActions.some((a) => a.includes("ICU")), "ICU triage action present for critical patient");
assert(Array.isArray(triageCrit.actions.diagnosticOrders), "Diagnostic orders array present");
assert(triageCrit.actions.diagnosticOrders.some((o) => o.includes("Blood cultures")), "Blood cultures ordered for critical case");
assert(typeof triageCrit.actions.contactTracing === "boolean", "Contact tracing flag is boolean");
assert(typeof triageCrit.actions.publicHealthReport === "boolean", "Public health report flag is boolean");

// Pre-existing condition multiplier
const hypertCritRaw = { ...criticalRaw, patientId: "PT-TEST-MULT", preExistingConditions: ["heart_failure", "diabetes"] };
const hypertCritPat  = createPatientRecord(hypertCritRaw);
const hypertEng      = evaluatePatient(hypertCritPat);
const hypertTriage   = classifySeverity(hypertCritPat, hypertEng);
assert(hypertTriage.severityScore >= triageCrit.severityScore, "Pre-existing condition multiplier increases severity score");

// Batch operations
const engineBatch = evaluatePatientBatch(SAMPLE_PATIENTS);
const triageBatch = classifyPatientBatch(SAMPLE_PATIENTS, engineBatch);
assert(engineBatch.length === SAMPLE_PATIENTS.length, "Batch engine produces one result per patient");
assert(triageBatch.length === SAMPLE_PATIENTS.length, "Batch triage produces one result per patient");

const summary = computeTriageSummary(triageBatch);
assert(summary.total === SAMPLE_PATIENTS.length, "Triage summary total matches patient count");
assert(summary.bySeverity.critical + summary.bySeverity.moderate + summary.bySeverity.low === SAMPLE_PATIENTS.length, "Severity counts sum to total");
assert(typeof summary.averageScore === "number", "Average score computed");
assert(summary.criticalPercentage >= 0 && summary.criticalPercentage <= 100, "Critical percentage in valid range");

// ── Test 4: Epidemiological Module ───────────────────────────────────────────

section("TEST 4: Epidemiological & Regional Risk Scoring");

const velocityGrowing = computeGrowthVelocity({
  "2025-01-15": 3, "2025-01-14": 4, "2025-01-13": 2,   // last 7 days = 9
  "2025-01-08": 1, "2025-01-07": 1,                      // prior 7 days = 2
});
assert(velocityGrowing.last7 > 0, "Last-7-day cases computed");
assert(velocityGrowing.prior7 >= 0, "Prior-7-day cases computed");
assert(["surging","rising","stable","declining"].includes(velocityGrowing.trend), "Velocity trend is valid enum value");

// Risk score calculation
const mockRegion = {
  totalCases: 10,
  severityCounts: { critical: 4, moderate: 4, low: 2 },
  casesByDay: { "2025-01-15": 3, "2025-01-14": 3, "2025-01-13": 2, "2025-01-08": 1, "2025-01-07": 1 },
  outbreakCandidates: 3,
  zipCodes: ["10001"],
};
const riskResult = computeOutbreakRiskScore(mockRegion, 50000);
assert(typeof riskResult.riskScore === "number", "Risk score is numeric");
assert(riskResult.riskScore >= 0 && riskResult.riskScore <= 100, `Risk score in [0,100] range (got ${riskResult.riskScore})`);
assert(["HIGH","MODERATE","LOW"].includes(riskResult.riskLevel), "Risk level is valid enum");
assert(typeof riskResult.outbreakTriggered === "boolean", "Outbreak triggered flag is boolean");
assert(riskResult.components.incidenceScore >= 0, "Incidence score component computed");
assert(riskResult.components.velocityScore >= 0, "Velocity score component computed");
assert(riskResult.components.severityScore >= 0, "Severity score component computed");

// Full regional pipeline
const regionalResults = runRegionalAnalysis(SAMPLE_PATIENTS, triageBatch);
assert(Array.isArray(regionalResults), "Regional analysis returns array");
assert(regionalResults.length > 0, "At least one region analyzed");
assert(regionalResults[0].riskScore >= regionalResults[regionalResults.length - 1].riskScore, "Regions sorted by risk score descending");
regionalResults.forEach((r) => {
  assert(r.riskScore >= 0 && r.riskScore <= 100, `Region ${r.regionId} score in valid range`);
});

// ── Test 5: End-to-End Pipeline ──────────────────────────────────────────────

section("TEST 5: End-to-End Pipeline Integration");

const state = runPipeline(SAMPLE_PATIENTS);

assert(state.patients.length === SAMPLE_PATIENTS.length, "Pipeline processes all patients");
assert(state.engineResults.length === SAMPLE_PATIENTS.length, "Engine results count matches");
assert(state.triageResults.length === SAMPLE_PATIENTS.length, "Triage results count matches");
assert(Array.isArray(state.regionalAnalysis), "Regional analysis produced");
assert(typeof state.triageSummary === "object", "Triage summary object produced");
assert(typeof state.publicHealthReport === "object", "Public health report produced");
assert(state.publicHealthReport.reportType === "PUBLIC_HEALTH_EPIDEMIOLOGICAL_EXPORT", "Correct report type");
assert(Object.keys(state.patientSummaries).length === SAMPLE_PATIENTS.length, "Patient summaries generated for all patients");

// Verify known patient classifications from sample data
const pt001Triage = state.triageResults.find((t) => t.patientId === "PT-001");
const pt010Triage = state.triageResults.find((t) => t.patientId === "PT-010");
assert(pt001Triage?.severity === "critical", "PT-001 (sepsis-like, SpO2 87%) classified as CRITICAL");
assert(["low","moderate"].includes(pt010Triage?.severity), "PT-010 (mild cold symptoms) classified as LOW or MODERATE");

// PLATFORM_STATE (pre-run)
assert(PLATFORM_STATE.patients.length > 0, "Pre-run PLATFORM_STATE populated");
assert(PLATFORM_STATE.pipelineRunAt !== undefined, "Pipeline run timestamp present");

// ── Test Summary ─────────────────────────────────────────────────────────────

section("TEST RESULTS");
console.log(`\n  Total Tests: ${passed + failed}`);
console.log(`  Passed:      ${passed}`);
console.log(`  Failed:      ${failed}`);
console.log(`  Pass Rate:   ${Math.round((passed / (passed + failed)) * 100)}%\n`);

if (failed > 0) process.exit(1);
