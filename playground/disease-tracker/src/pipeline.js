/**
 * Central Pipeline Integration
 * Orchestrates all modules: ingest → rules engine → triage → epidemiology → reports
 */

import { SAMPLE_PATIENTS } from "./data/samplePatients.js";
import { evaluatePatientBatch } from "./engine/rulesEngine.js";
import { classifyPatientBatch, computeTriageSummary } from "./engine/triageClassifier.js";
import { runRegionalAnalysis } from "./engine/epidemiology.js";
import { generatePatientClinicalSummary, generatePublicHealthReport } from "./reports/reportGenerator.js";

// Regional population estimates for incidence rate calculations
const POPULATION_MAP = {
  "Manhattan North": 80000,
  "Manhattan South": 65000,
  "Brooklyn West":   90000,
  "Queens":          120000,
  "Bronx":           95000,
  "Staten Island":   40000,
};

/**
 * Runs the full platform pipeline on a given patient dataset
 * @param {Array} patients - Array of validated patient records (defaults to sample data)
 * @returns {Object} Full platform state
 */
export function runPipeline(patients = SAMPLE_PATIENTS) {
  // Step 1: Rules Engine
  const engineResults = evaluatePatientBatch(patients);

  // Step 2: Triage Classification
  const triageResults = classifyPatientBatch(patients, engineResults);

  // Step 3: Epidemiological Analysis
  const regionalAnalysis = runRegionalAnalysis(patients, triageResults, POPULATION_MAP);

  // Step 4: Summary Statistics
  const triageSummary = computeTriageSummary(triageResults);

  // Step 5: Reports
  const publicHealthReport = generatePublicHealthReport(
    patients, triageResults, engineResults, regionalAnalysis
  );

  // Step 6: Per-patient summaries (keyed by patientId)
  const patientSummaries = {};
  patients.forEach((p, i) => {
    patientSummaries[p.patientId] = generatePatientClinicalSummary(
      p, engineResults[i], triageResults[i]
    );
  });

  return {
    patients,
    engineResults,
    triageResults,
    triageSummary,
    regionalAnalysis,
    patientSummaries,
    publicHealthReport,
    pipelineRunAt: new Date().toISOString(),
  };
}

// Run the pipeline immediately for dashboard use
export const PLATFORM_STATE = runPipeline();
