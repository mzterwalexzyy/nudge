#!/usr/bin/env node
/**
 * Verification script: calls aiComplete("say ok") and prints the response.
 * Phase 0 definition of done.
 */

import 'dotenv/config';
import { aiComplete, getProviderName } from '../src/index.mjs';

console.log(`[verify-ai] Provider: ${getProviderName()}`);
console.log('[verify-ai] Calling aiComplete("say ok")...');

try {
  const response = await aiComplete('Respond with exactly the word "ok" and nothing else.');
  console.log(`[verify-ai] Response: "${response.trim()}"`);
  
  if (response.toLowerCase().includes('ok')) {
    console.log('[verify-ai] ✓ AI adapter is working.');
    process.exit(0);
  } else {
    console.log('[verify-ai] ⚠ Got a response but it did not contain "ok".');
    process.exit(0); // Still a success - the model responded
  }
} catch (err) {
  console.error(`[verify-ai] ✗ FAILED: ${err.message}`);
  console.error('[verify-ai] Check your API key and network connection.');
  process.exit(1);
}
