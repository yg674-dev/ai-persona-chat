/**
 * MCP Discovery Client
 *
 * Calls the backend proxy to discover relevant MCP servers for a given topic.
 * Uses in-memory client-side cache to avoid redundant backend calls within a session.
 *
 * Backend endpoint: GET /api/mcp/discover?topic={topic}
 */

// ── API URL ────────────────────────────────────────────────────────────────────
// Set to your deployed Vercel URL in production
const IS_DEV = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
export const DISCOVERY_API = IS_DEV
  ? 'http://localhost:3001/api'
  : 'https://persona-ai-proxy.vercel.app/api';

// ── Client-side session cache ──────────────────────────────────────────────────
// Maps normalized topic → { results: McpServer[], expiresAt: number }
const _cache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function _getCached(topic) {
  const entry = _cache.get(topic.toLowerCase().trim());
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _cache.delete(topic.toLowerCase().trim());
    return null;
  }
  return entry.results;
}

function _setCached(topic, results) {
  _cache.set(topic.toLowerCase().trim(), {
    results,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Discover MCP servers relevant to a topic.
 *
 * @param {string} topic - Domain or topic to search (e.g. "code review", "database")
 * @returns {Promise<McpServer[]>} Array of discovered MCP server objects
 *
 * @typedef {object} McpServer
 * @property {string} id - Unique identifier
 * @property {string} name - Display name
 * @property {string} description - What the server provides
 * @property {string} sourceUrl - Where it was found
 * @property {string} [installCommand] - CLI install command if available
 * @property {string[]} tags - Semantic tags for matching
 * @property {number} relevanceScore - 0–1 relevance score
 * @property {'discovered'|'available'|'connected'} status
 */
export async function discoverServers(topic) {
  if (!topic || !topic.trim()) return [];

  // Check client-side cache first
  const cached = _getCached(topic);
  if (cached) {
    return cached;
  }

  try {
    const url = `${DISCOVERY_API}/mcp/discover?topic=${encodeURIComponent(topic.trim())}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (res.status === 429) {
      const data = await res.json().catch(() => ({}));
      throw new DiscoveryError('rate_limited', data.message || 'Discovery rate limited. Try again shortly.', data.retryAfter);
    }

    if (res.status === 503) {
      throw new DiscoveryError('discovery_unavailable', 'MCP registries unavailable. Check your connection.', null);
    }

    if (!res.ok) {
      throw new DiscoveryError('http_error', `Discovery failed: HTTP ${res.status}`, null);
    }

    const data = await res.json();
    const results = (data.results || []).map(normalizeServer);

    _setCached(topic, results);
    return results;

  } catch (err) {
    if (err instanceof DiscoveryError) throw err;
    // Network or parse error
    throw new DiscoveryError('network_error', 'Could not reach discovery service. The backend may not be running.', null);
  }
}

/**
 * Check if the discovery backend is reachable.
 * @returns {Promise<boolean>}
 */
export async function isDiscoveryAvailable() {
  try {
    const res = await fetch(`${DISCOVERY_API}/health`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Clear the client-side discovery cache.
 */
export function clearDiscoveryCache() {
  _cache.clear();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeServer(raw) {
  return {
    id:             raw.id || slugify(raw.name || 'unknown'),
    name:           raw.name || 'Unknown Server',
    description:    raw.description || '',
    sourceUrl:      raw.sourceUrl || raw.source_url || '',
    installCommand: raw.installCommand || raw.install_command || null,
    tags:           Array.isArray(raw.tags) ? raw.tags : [],
    relevanceScore: typeof raw.relevanceScore === 'number' ? raw.relevanceScore : (raw.relevance_score || 0),
    status:         'discovered'
  };
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Custom error class for discovery failures.
 */
export class DiscoveryError extends Error {
  constructor(code, message, retryAfter) {
    super(message);
    this.name = 'DiscoveryError';
    this.code = code;
    this.retryAfter = retryAfter;
  }
}
