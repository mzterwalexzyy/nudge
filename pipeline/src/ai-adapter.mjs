/**
 * AI Provider Adapter
 * 
 * Provides a unified interface for AI completion and embedding.
 * Switchable between providers via AI_PROVIDER env var.
 * 
 * Supported providers:
 *   - gemini (default): Google Gemini Flash free tier
 *   - groq: Groq Llama (free tier)
 * 
 * Interface:
 *   aiComplete(prompt, options?) -> string
 *   aiEmbed(text) -> number[]
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// --- Provider Interface ---

class AIProvider {
  async complete(prompt, options = {}) {
    throw new Error('complete() not implemented');
  }
  async embed(text) {
    throw new Error('embed() not implemented');
  }
}

// --- Gemini Provider ---

class GeminiProvider extends AIProvider {
  constructor() {
    super();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set in environment');
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = this.client.getGenerativeModel({ model: 'gemini-2.0-flash' });
    this.embedModel = this.client.getGenerativeModel({ model: 'text-embedding-004' });
  }

  async complete(prompt, options = {}) {
    const { jsonMode = false, maxTokens = 2048 } = options;
    
    const generationConfig = {
      maxOutputTokens: maxTokens,
    };
    
    if (jsonMode) {
      generationConfig.responseMimeType = 'application/json';
    }

    const result = await this.model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
    });

    const response = result.response;
    return response.text();
  }

  async embed(text) {
    const result = await this.embedModel.embedContent(text);
    return result.embedding.values;
  }
}

// --- Groq Provider ---

class GroqProvider extends AIProvider {
  constructor() {
    super();
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not set in environment');
    // Dynamic import to avoid requiring groq-sdk when not using it
    this.apiKey = apiKey;
    this._client = null;
  }

  async _getClient() {
    if (!this._client) {
      const { default: Groq } = await import('groq-sdk');
      this._client = new Groq({ apiKey: this.apiKey });
    }
    return this._client;
  }

  async complete(prompt, options = {}) {
    const { jsonMode = false, maxTokens = 2048 } = options;
    const client = await this._getClient();
    const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

    const buildParams = (useJsonMode) => ({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      ...(useJsonMode ? { response_format: { type: 'json_object' } } : {}),
    });

    // Retry wrapper for transient errors (connection/5xx/429).
    const callWithRetry = async (params, attempts = 3) => {
      let lastErr;
      for (let i = 0; i < attempts; i++) {
        try {
          const completion = await client.chat.completions.create(params);
          return completion.choices[0]?.message?.content || '';
        } catch (err) {
          lastErr = err;
          const status = err?.status || err?.response?.status;
          const transient =
            !status || status === 429 || (status >= 500 && status < 600) ||
            /connection|timeout|ECONNRESET|ETIMEDOUT|fetch failed/i.test(err?.message || '');
          // json_validate_failed is NOT transient - handled by caller fallback
          if (err?.error?.code === 'json_validate_failed' || /json_validate_failed/i.test(err?.message || '')) {
            throw err;
          }
          if (!transient || i === attempts - 1) throw err;
          await new Promise(r => setTimeout(r, 800 * (i + 1)));
        }
      }
      throw lastErr;
    };

    if (jsonMode) {
      try {
        return await callWithRetry(buildParams(true));
      } catch (err) {
        // Groq sometimes rejects its own JSON output (json_validate_failed).
        // Fall back to plain completion; our downstream parser extracts the object.
        if (err?.error?.code === 'json_validate_failed' || /json_validate_failed/i.test(err?.message || '')) {
          const jsonPrompt = prompt + '\n\nIMPORTANT: Respond with ONLY valid JSON. No prose, no code fences.';
          return await callWithRetry({ ...buildParams(false), messages: [{ role: 'user', content: jsonPrompt }] });
        }
        throw err;
      }
    }

    return await callWithRetry(buildParams(false));
  }

  async embed(text) {
    // Groq has no native embedding endpoint. Fall back to a deterministic
    // local pseudo-embedding. Warn ONCE so logs stay readable.
    if (!GroqProvider._warnedEmbed) {
      console.warn('[GroqProvider] embed() using local fallback (Groq has no embeddings endpoint) - dedup is weaker than true semantic embeddings');
      GroqProvider._warnedEmbed = true;
    }
    return localFallbackEmbed(text);
  }
}

// --- Local fallback embedding (for testing only) ---

function localFallbackEmbed(text) {
  // Simple deterministic pseudo-embedding based on character frequencies
  // Returns 768-dimensional vector (matching Gemini embedding size)
  const dim = 768;
  const vec = new Array(dim).fill(0);
  const words = text.toLowerCase().split(/\s+/);
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    for (let j = 0; j < word.length; j++) {
      const idx = (word.charCodeAt(j) * 31 + i * 7 + j * 13) % dim;
      vec[idx] += 1.0 / words.length;
    }
  }
  
  // Normalize
  const mag = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (mag > 0) {
    for (let i = 0; i < dim; i++) vec[i] /= mag;
  }
  
  return vec;
}

// --- Factory ---

const providers = {
  gemini: GeminiProvider,
  groq: GroqProvider,
};

let activeProvider = null;

function getProvider() {
  if (activeProvider) return activeProvider;
  
  const providerName = (process.env.AI_PROVIDER || 'groq').toLowerCase();
  const ProviderClass = providers[providerName];
  
  if (!ProviderClass) {
    throw new Error(`Unknown AI_PROVIDER: ${providerName}. Supported: ${Object.keys(providers).join(', ')}`);
  }
  
  activeProvider = new ProviderClass();
  return activeProvider;
}

// --- Public API ---

/**
 * Generate a text completion from the AI model.
 * @param {string} prompt - The prompt to send
 * @param {object} options - { jsonMode: boolean, maxTokens: number }
 * @returns {Promise<string>} The model's response text
 */
export async function aiComplete(prompt, options = {}) {
  const provider = getProvider();
  return provider.complete(prompt, options);
}

/**
 * Generate an embedding vector for the given text.
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} Embedding vector
 */
export async function aiEmbed(text) {
  const provider = getProvider();
  return provider.embed(text);
}

/**
 * Reset the active provider (useful for testing).
 */
export function resetProvider() {
  activeProvider = null;
}

/**
 * Get the current provider name.
 */
export function getProviderName() {
  return (process.env.AI_PROVIDER || 'groq').toLowerCase();
}
