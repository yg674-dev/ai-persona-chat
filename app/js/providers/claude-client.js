/**
 * Claude Client
 *
 * Wraps Anthropic API calls using direct fetch (no SDK needed for streaming).
 * API key is read from sessionStorage — NEVER from localStorage or hardcoded.
 *
 * Security: API key is never logged, never sent to the backend proxy,
 * and only lives in sessionStorage for the current browser session.
 */

import { getApiKey } from '../utils/session-storage.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

/**
 * Anthropic Claude client.
 * Implements the provider interface expected by chat.js and clarification/engine.js
 */
export class ClaudeClient {
  constructor() {
    this.provider = 'anthropic';
  }

  /**
   * Get the current API key from sessionStorage.
   * @returns {string}
   */
  _getKey() {
    return getApiKey('anthropic');
  }

  /**
   * Non-streaming completion — used by clarification engine.
   * Returns the full text response.
   *
   * @param {object} options
   * @param {string} options.systemPrompt
   * @param {object[]} options.messages - [{role, content}]
   * @param {string} options.model
   * @param {number} [options.maxTokens=1024]
   * @param {number} [options.temperature=1]
   * @returns {Promise<string>}
   */
  async complete({ systemPrompt, messages, model, maxTokens = 1024, temperature = 1 }) {
    const key = this._getKey();
    if (!key) throw new Error('No Anthropic API key set. Please add your key in settings.');

    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-calls': 'true'
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const err = new Error(errData.error?.message || `Claude API error: HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    return data.content?.[0]?.text || '';
  }

  /**
   * Streaming completion — used by main chat.
   * Calls onDelta(text) for each streamed chunk.
   * Returns the full response text.
   *
   * @param {object} options
   * @param {string} options.systemPrompt
   * @param {object[]} options.messages
   * @param {string} options.model
   * @param {number} [options.maxTokens=2048]
   * @param {function} options.onDelta - Called with each text chunk
   * @returns {Promise<string>}
   */
  async stream({ systemPrompt, messages, model, maxTokens = 2048, onDelta }) {
    const key = this._getKey();
    if (!key) throw new Error('No Anthropic API key set. Please add your key in settings.');

    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-calls': 'true'
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
        stream: true
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const err = new Error(errData.error?.message || `Claude API error: HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }

    let fullText = '';
    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
            const delta = parsed.delta.text;
            fullText += delta;
            if (onDelta) onDelta(delta);
          }
        } catch {
          // Skip malformed lines
        }
      }
    }

    return fullText;
  }
}
