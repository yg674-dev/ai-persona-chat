/**
 * MCP Discovery Route — powered by mcpadvisor APIs
 *
 * GET /api/mcp/discover?topic={topic}
 *   Searches MCPHub (Compass) + GetMCP registries for relevant MCP servers.
 *   Results cached in-memory with 1-hour TTL.
 *
 * GET /api/mcp/cache/clear
 *   Clears the in-memory discovery cache (admin/debug).
 */

const express = require('express');
const router = express.Router();

// ── API endpoints (same as mcpadvisor) ───────────────────────────────────────
const COMPASS_API  = process.env.COMPASS_API_BASE || 'https://registry.mcphub.io';
const GETMCP_API   = process.env.GETMCP_API_URL   || 'https://getmcp.io/api/servers.json';

// ── In-memory cache ───────────────────────────────────────────────────────────
const _cache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCached(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { _cache.delete(key); return null; }
  return entry;
}
function setCached(key, results) {
  _cache.set(key, { results, expiresAt: Date.now() + CACHE_TTL_MS, searchedAt: new Date().toISOString() });
}
function normalizeTopic(t) { return t.toLowerCase().trim().replace(/\s+/g, ' '); }

// ── Main Discovery Endpoint ───────────────────────────────────────────────────
router.get('/discover', async (req, res) => {
  const { topic } = req.query;
  if (!topic?.trim()) {
    return res.status(400).json({ error: 'missing_topic', message: 'Query parameter "topic" is required.' });
  }

  const key = normalizeTopic(topic);
  const cached = getCached(key);
  if (cached) return res.json({ cached: true, results: cached.results, searchedAt: cached.searchedAt });

  const searchedAt = new Date().toISOString();

  const [compassRes, getMcpRes, githubRes] = await Promise.allSettled([
    searchCompass(key),
    searchGetMcp(key),
    searchGitHub(key)
  ]);

  if (compassRes.status === 'rejected') console.warn('[MCP] Compass failed:', compassRes.reason?.message);
  if (getMcpRes.status  === 'rejected') console.warn('[MCP] GetMCP failed:',  getMcpRes.reason?.message);
  if (githubRes.status  === 'rejected') console.warn('[MCP] GitHub failed:',  githubRes.reason?.message);

  const compassResults = compassRes.status === 'fulfilled' ? compassRes.value : [];
  const getMcpResults  = getMcpRes.status  === 'fulfilled' ? getMcpRes.value  : [];
  const githubResults  = githubRes.status  === 'fulfilled' ? githubRes.value  : getKnownFallback(key);

  // Merge + deduplicate by name
  const seen = new Set();
  const all = [...compassResults, ...getMcpResults, ...githubResults].filter(s => {
    const k = s.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  const results = all.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0)).slice(0, 8);
  setCached(key, results);
  return res.json({ cached: false, results, searchedAt });
});

// ── Cache Clear ───────────────────────────────────────────────────────────────
router.get('/cache/clear', (req, res) => {
  const size = _cache.size;
  _cache.clear();
  res.json({ status: 'cleared', entriesCleared: size });
});

// ── Compass / MCPHub (semantic search — best quality) ────────────────────────
async function searchCompass(query) {
  const url = `${COMPASS_API}/recommend?description=${encodeURIComponent(query)}`;
  const res = await fetchWithTimeout(url, {
    headers: { 'User-Agent': 'persona-ai/1.0', 'Accept': 'application/json' }
  }, 10000);
  if (!res.ok) throw new Error(`Compass returned ${res.status}`);
  const data = await res.json();
  return (Array.isArray(data) ? data : []).slice(0, 5).map(d => ({
    id:             slugify(d.name || d.title || 'compass-server'),
    name:           d.name || d.title || 'Unnamed',
    description:    d.description || d.summary || '',
    sourceUrl:      d.github_url || d.url || `${COMPASS_API}`,
    installCommand: d.install || d.installCommand || inferInstall(d.name, d.language),
    tags:           [...(d.tags || []), 'mcphub'],
    relevanceScore: d.score || d.similarity || 0.7,
    status:         'discovered',
    source:         'MCPHub'
  }));
}

// ── GetMCP (full catalog, keyword filter) ────────────────────────────────────
async function searchGetMcp(query) {
  const cacheKey = '__getmcp_catalog__';
  let catalog;

  const cached = getCached(cacheKey);
  if (cached) {
    catalog = cached.results;
  } else {
    const res = await fetchWithTimeout(GETMCP_API, {
      headers: { 'User-Agent': 'persona-ai/1.0', 'Accept': 'application/json' }
    }, 10000);
    if (!res.ok) throw new Error(`GetMCP returned ${res.status}`);
    catalog = await res.json();
    setCached(cacheKey, catalog);
  }

  const servers = Array.isArray(catalog) ? catalog : (catalog.servers || catalog.data || []);
  const keywords = query.split(' ').filter(w => w.length > 2);

  return servers
    .map(s => {
      const text = `${s.name || ''} ${s.description || ''} ${(s.tags || []).join(' ')}`.toLowerCase();
      const score = scoreRelevance(text, keywords);
      return {
        id:             slugify(s.name || s.id || 'getmcp'),
        name:           s.name || s.title || 'Unnamed',
        description:    s.description || s.summary || '',
        sourceUrl:      s.github_url || s.url || s.homepage || 'https://getmcp.io',
        installCommand: s.install || s.installCommand || inferInstall(s.name, s.language),
        tags:           [...(s.tags || []), 'getmcp'],
        relevanceScore: score,
        status:         'discovered',
        source:         'GetMCP'
      };
    })
    .filter(s => s.relevanceScore > 0.2)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 5);
}

// ── GitHub Search ─────────────────────────────────────────────────────────────
async function searchGitHub(query) {
  const q = encodeURIComponent(`${query} mcp-server topic:mcp`);
  const url = `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=5`;
  const headers = { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'persona-ai/1.0' };
  if (process.env.GITHUB_TOKEN) headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;

  const res = await fetchWithTimeout(url, { headers }, 8000);
  if (res.status === 403) throw new Error('GitHub rate limited');
  if (!res.ok) throw new Error(`GitHub ${res.status}`);

  const data = await res.json();
  const keywords = query.split(' ').filter(w => w.length > 2);

  return (data.items || []).map(repo => ({
    id:             slugify(repo.full_name),
    name:           repo.name,
    description:    repo.description || '',
    sourceUrl:      repo.html_url,
    installCommand: inferInstall(repo.name, repo.language),
    tags:           [...(repo.topics || []), 'github'],
    relevanceScore: scoreRelevance(`${repo.name} ${repo.description || ''} ${(repo.topics||[]).join(' ')}`, keywords),
    status:         'discovered',
    source:         'GitHub'
  })).filter(s => s.relevanceScore > 0.1);
}

// ── Known fallback servers ────────────────────────────────────────────────────
const KNOWN_SERVERS = [
  { id: 'github-mcp',     name: 'GitHub MCP Server',    description: 'GitHub repo access, PR review, issue tracking', tags: ['github','code','git'], installCommand: 'npx @modelcontextprotocol/server-github', sourceUrl: 'https://github.com/modelcontextprotocol/servers', source: 'Official' },
  { id: 'filesystem-mcp', name: 'Filesystem MCP',        description: 'Read and write local filesystem files',         tags: ['files','local','io'],  installCommand: 'npx @modelcontextprotocol/server-filesystem', sourceUrl: 'https://github.com/modelcontextprotocol/servers', source: 'Official' },
  { id: 'postgres-mcp',   name: 'PostgreSQL MCP',        description: 'Query PostgreSQL databases via MCP',            tags: ['database','sql','data'],installCommand: 'npx @modelcontextprotocol/server-postgres',   sourceUrl: 'https://github.com/modelcontextprotocol/servers', source: 'Official' },
  { id: 'brave-search',   name: 'Brave Search MCP',      description: 'Web search via Brave Search API',              tags: ['search','web'],        installCommand: 'npx @modelcontextprotocol/server-brave-search',sourceUrl: 'https://github.com/modelcontextprotocol/servers', source: 'Official' },
  { id: 'fetch-mcp',      name: 'Fetch MCP',             description: 'HTTP fetch and web content retrieval',          tags: ['http','web','fetch'],   installCommand: 'npx @modelcontextprotocol/server-fetch',       sourceUrl: 'https://github.com/modelcontextprotocol/servers', source: 'Official' },
  { id: 'slack-mcp',      name: 'Slack MCP',             description: 'Send and read Slack messages',                  tags: ['slack','messaging'],    installCommand: 'npx @modelcontextprotocol/server-slack',       sourceUrl: 'https://github.com/modelcontextprotocol/servers', source: 'Official' },
  { id: 'sqlite-mcp',     name: 'SQLite MCP',            description: 'Query and manage SQLite databases',             tags: ['database','sql'],       installCommand: 'npx @modelcontextprotocol/server-sqlite',      sourceUrl: 'https://github.com/modelcontextprotocol/servers', source: 'Official' },
  { id: 'puppeteer-mcp',  name: 'Puppeteer MCP',         description: 'Browser automation and web scraping',           tags: ['browser','automation'], installCommand: 'npx @modelcontextprotocol/server-puppeteer',    sourceUrl: 'https://github.com/modelcontextprotocol/servers', source: 'Official' },
];
function getKnownFallback(query) {
  const kw = query.split(' ').filter(w => w.length > 2);
  return KNOWN_SERVERS.map(s => ({
    ...s, status: 'discovered',
    relevanceScore: scoreRelevance(`${s.name} ${s.description} ${s.tags.join(' ')}`, kw)
  })).filter(s => s.relevanceScore > 0.1).sort((a,b) => b.relevanceScore - a.relevanceScore).slice(0, 3);
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function scoreRelevance(text, keywords) {
  const t = text.toLowerCase();
  let hits = 0;
  for (const kw of keywords) if (kw.length > 2 && t.includes(kw)) hits++;
  return keywords.length > 0 ? hits / keywords.length : 0;
}
function slugify(s) { return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
function inferInstall(name, lang) {
  if (!name) return null;
  if (lang === 'Python') return `uvx mcp-server-${name.toLowerCase()}`;
  return `npx @modelcontextprotocol/${name.toLowerCase()}`;
}
async function fetchWithTimeout(url, options={}, ms=8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...options, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

module.exports = router;
