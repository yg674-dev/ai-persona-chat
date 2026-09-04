/**
 * Secure Session Storage Helpers
 *
 * API keys are stored ONLY in sessionStorage (cleared when tab/browser closes).
 * Keys are NEVER stored in localStorage, NEVER logged, NEVER sent to any backend.
 *
 * Security guarantees:
 * - sessionStorage is tab-scoped and cleared on tab close
 * - No key is ever written to localStorage in this module
 * - No key is ever included in fetch requests to the backend proxy
 */

const PREFIX = 'persona_ai_';

// Storage key names — all scoped with PREFIX
export const STORAGE_KEYS = {
  API_KEY_ANTHROPIC: `${PREFIX}key_anthropic`,
  API_KEY_OPENAI:    `${PREFIX}key_openai`,
  PROVIDER:          `${PREFIX}provider`,
  MODEL_ANTHROPIC:   `${PREFIX}model_anthropic`,
  MODEL_OPENAI:      `${PREFIX}model_openai`,
  THEME:             `${PREFIX}theme`,
  LAST_PERSONA:      `${PREFIX}last_persona`,
};

// ── API Key operations (sessionStorage only) ──────────────────────────────────

/**
 * Store an API key in sessionStorage.
 * @param {'anthropic'|'openai'} provider
 * @param {string} key - The API key value
 */
export function setApiKey(provider, key) {
  const storageKey = provider === 'openai'
    ? STORAGE_KEYS.API_KEY_OPENAI
    : STORAGE_KEYS.API_KEY_ANTHROPIC;
  sessionStorage.setItem(storageKey, key);
}

/**
 * Retrieve an API key from sessionStorage.
 * @param {'anthropic'|'openai'} provider
 * @returns {string} The API key, or empty string if not set
 */
export function getApiKey(provider) {
  const storageKey = provider === 'openai'
    ? STORAGE_KEYS.API_KEY_OPENAI
    : STORAGE_KEYS.API_KEY_ANTHROPIC;
  return sessionStorage.getItem(storageKey) || '';
}

/**
 * Remove an API key from sessionStorage.
 * @param {'anthropic'|'openai'} provider
 */
export function clearApiKey(provider) {
  const storageKey = provider === 'openai'
    ? STORAGE_KEYS.API_KEY_OPENAI
    : STORAGE_KEYS.API_KEY_ANTHROPIC;
  sessionStorage.removeItem(storageKey);
}

/**
 * Check if an API key is set for a provider.
 * @param {'anthropic'|'openai'} provider
 * @returns {boolean}
 */
export function hasApiKey(provider) {
  return getApiKey(provider).length > 0;
}

/**
 * Clear all API keys from sessionStorage.
 */
export function clearAllApiKeys() {
  sessionStorage.removeItem(STORAGE_KEYS.API_KEY_ANTHROPIC);
  sessionStorage.removeItem(STORAGE_KEYS.API_KEY_OPENAI);
}

// ── Preference operations (localStorage — non-sensitive) ──────────────────────

/**
 * Get a user preference from localStorage.
 * Only use for non-sensitive settings (theme, last persona, model selection).
 * @param {string} key - One of STORAGE_KEYS values (non-API-key ones)
 * @param {string} [defaultValue='']
 * @returns {string}
 */
export function getPref(key, defaultValue = '') {
  return localStorage.getItem(key) || defaultValue;
}

/**
 * Set a user preference in localStorage.
 * @param {string} key
 * @param {string} value
 */
export function setPref(key, value) {
  localStorage.setItem(key, value);
}

/**
 * Remove a user preference from localStorage.
 * @param {string} key
 */
export function clearPref(key) {
  localStorage.removeItem(key);
}
