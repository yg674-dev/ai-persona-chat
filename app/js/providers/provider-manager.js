/**
 * Provider Manager
 *
 * Manages active AI provider (Claude or OpenAI), model selection, and
 * exposes a unified client interface for the rest of the app.
 *
 * API keys are read from sessionStorage via session-storage.js.
 * This module NEVER touches API keys directly.
 */

import { ClaudeClient } from './claude-client.js';
import { OpenAIClient } from './openai-client.js';
import {
  getApiKey, hasApiKey,
  STORAGE_KEYS, getPref, setPref
} from '../utils/session-storage.js';

// ── Available models ───────────────────────────────────────────────────────────
export const MODELS = {
  anthropic: [
    { id: 'claude-opus-4-6',           label: 'Claude Opus 4.6',   desc: 'Most capable' },
    { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6', desc: 'Balanced — recommended' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5',  desc: 'Fast & affordable' },
  ],
  openai: [
    { id: 'gpt-4o',      label: 'GPT-4o',      desc: 'Most capable' },
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini', desc: 'Fast & affordable' },
    { id: 'o1-mini',     label: 'o1 Mini',      desc: 'Advanced reasoning' },
  ]
};

// ── State ──────────────────────────────────────────────────────────────────────
let _provider = getPref(STORAGE_KEYS.PROVIDER, 'anthropic');
let _modelAnthropic = getPref(STORAGE_KEYS.MODEL_ANTHROPIC, 'claude-sonnet-4-6');
let _modelOpenAI = getPref(STORAGE_KEYS.MODEL_OPENAI, 'gpt-4o');

const _claudeClient = new ClaudeClient();
const _openaiClient = new OpenAIClient();

// Change listeners
const _listeners = new Set();

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Set the active provider and optionally the model.
 * @param {'anthropic'|'openai'} provider
 * @param {string} [model] - Optional model ID to set simultaneously
 */
export function setProvider(provider, model) {
  if (provider !== 'anthropic' && provider !== 'openai') {
    throw new Error(`Invalid provider: ${provider}. Must be 'anthropic' or 'openai'.`);
  }

  const prevProvider = _provider;
  _provider = provider;
  setPref(STORAGE_KEYS.PROVIDER, provider);

  if (model) {
    setModel(provider, model);
  }

  _notifyListeners({
    type: 'provider_change',
    provider,
    prevProvider,
    model: getActiveModel()
  });
}

/**
 * Set the model for a specific provider.
 * @param {'anthropic'|'openai'} provider
 * @param {string} modelId
 */
export function setModel(provider, modelId) {
  if (provider === 'anthropic') {
    _modelAnthropic = modelId;
    setPref(STORAGE_KEYS.MODEL_ANTHROPIC, modelId);
  } else {
    _modelOpenAI = modelId;
    setPref(STORAGE_KEYS.MODEL_OPENAI, modelId);
  }

  _notifyListeners({
    type: 'model_change',
    provider,
    model: modelId
  });
}

/**
 * Get the active provider identifier.
 * @returns {'anthropic'|'openai'}
 */
export function getActiveProvider() {
  return _provider;
}

/**
 * Get the active model ID for the current provider.
 * @returns {string}
 */
export function getActiveModel() {
  return _provider === 'openai' ? _modelOpenAI : _modelAnthropic;
}

/**
 * Get the active model's display label.
 * @returns {string}
 */
export function getActiveModelLabel() {
  const models = MODELS[_provider] || [];
  const modelId = getActiveModel();
  const model = models.find(m => m.id === modelId);
  return model ? model.label : modelId;
}

/**
 * Get the active provider client.
 * Returns a client with .complete() and .stream() methods.
 * @returns {ClaudeClient|OpenAIClient}
 */
export function getActiveClient() {
  return _provider === 'openai' ? _openaiClient : _claudeClient;
}

/**
 * Check if the active provider has an API key set.
 * @returns {boolean}
 */
export function isProviderReady() {
  return hasApiKey(_provider);
}

/**
 * Get the API key for the active provider (for validation/display only).
 * Returns masked key — never the full key.
 * @returns {string} Masked key like "sk-ant-***...abc"
 */
export function getMaskedKey() {
  const key = getApiKey(_provider);
  if (!key || key.length < 8) return '';
  return key.substring(0, 10) + '***' + key.substring(key.length - 4);
}

/**
 * Check if any provider has an API key set.
 * @returns {boolean}
 */
export function hasAnyKey() {
  return hasApiKey('anthropic') || hasApiKey('openai');
}

/**
 * Subscribe to provider/model changes.
 * @param {function} listener
 * @returns {function} Unsubscribe
 */
export function onProviderChange(listener) {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

/**
 * Execute a non-streaming completion with the active provider and model.
 * Convenience wrapper — equivalent to getActiveClient().complete({...model}).
 *
 * @param {object} options
 * @param {string} options.systemPrompt
 * @param {object[]} options.messages
 * @param {number} [options.maxTokens]
 * @param {number} [options.temperature]
 * @returns {Promise<string>}
 */
export function complete(options) {
  return getActiveClient().complete({
    ...options,
    model: getActiveModel()
  });
}

/**
 * Execute a streaming completion with the active provider and model.
 *
 * @param {object} options
 * @param {string} options.systemPrompt
 * @param {object[]} options.messages
 * @param {number} [options.maxTokens]
 * @param {function} options.onDelta
 * @returns {Promise<string>}
 */
export function stream(options) {
  return getActiveClient().stream({
    ...options,
    model: getActiveModel()
  });
}

// ── Internal ──────────────────────────────────────────────────────────────────

function _notifyListeners(event) {
  _listeners.forEach(fn => {
    try { fn(event); } catch (e) { /* ignore listener errors */ }
  });
}
