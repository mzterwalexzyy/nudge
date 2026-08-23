/** Public API for the shared NUDGE pipeline. */

export { aiComplete, aiEmbed, resetProvider, getProviderName } from './ai-adapter.mjs';

export {
  getDb,
  initSchema,
  migrateSchema,
  migrateColumns,
  insertItem,
  getItemByUrl,
  getItemByCaptureKey,
  getItemById,
  getAllItems,
  getItemsByStatus,
  getItemsByAttention,
  updateItem,
  getItemsWithEmbeddings,
  getChildren,
  deleteItem,
  closeDb,
} from './db.mjs';

export { ingest, extractFromHtml } from './ingest.mjs';
export { safeIngest, assertPublicHttpUrl, isPrivateAddress, selectOutboundLink } from './safe-ingest.mjs';
export { classify, VALID_KINDS } from './classify.mjs';
export { extractDates } from './extract-dates.mjs';
export { assignAttention, daysUntil } from './attention.mjs';
export { embed, findDuplicates, cosineSimilarity, DEFAULT_THRESHOLD } from './embed.mjs';
export { checkLiveness } from './liveness.mjs';
export { detectMultiplicity, MAX_ENTRIES } from './multiplicity.mjs';
export { processItem, processItemTree } from './pipeline.mjs';
export { classifyAgreement } from './agreement.mjs';
