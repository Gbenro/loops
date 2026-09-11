/**
 * Client-side and test runtime adapter for the Luna Sidecar Intelligent Model-Routing Lab.
 * Decouples model selection from harness execution substrates and exports task taxonomy.
 */

export {
  TASK_TAXONOMY,
  LAB_CANDIDATE_POOL,
  classifyLabTask,
  resolveLabRoute,
  deriveTaskCriteria,
  evaluateArtifactAgainstCriteria,
  executeLabTask,
  runLabBenchmark,
  saveLabTelemetry,
  getLabTelemetry,
  listLabExperiments,
  clearLabTelemetry,
  registerModelRoutingLabRoutes
} from '../../mcp-server/dist/modelRoutingLab.js';
