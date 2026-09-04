/**
 * Workflow Recommendation Engine
 *
 * Scores available skills and connected MCP servers against a confirmed intent
 * using tag-based matching with persona category boost.
 *
 * Algorithm:
 * 1. Extract keywords from confirmedIntent
 * 2. Score each skill/MCP server by tag overlap with keywords
 * 3. Apply 1.2x boost if skill tags overlap with persona's workflowTags
 * 4. Return top 3 ranked WorkflowRecommendation objects
 */

import { SKILLS, getSkillById } from './skill-registry.js';
import { getPersonaById } from '../personas/registry.js';

// ── In-session feedback tracking ──────────────────────────────────────────────
const _acceptanceLog = new Map(); // recommendationId → 'accepted' | 'overridden'

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Get ranked workflow recommendations for a confirmed intent.
 *
 * @param {string} confirmedIntent - The resolved user intent summary
 * @param {string} personaId - Active persona ID (for category boost)
 * @param {object[]} connectedMcpServers - Currently connected MCP servers
 * @returns {{ recommendations: WorkflowRecommendation[] }}
 *
 * @typedef {object} WorkflowRecommendation
 * @property {string} id
 * @property {'skill'|'mcp-server'} type
 * @property {string} name
 * @property {string} rationale
 * @property {number} score - 0–1 relevance score
 * @property {boolean} [accepted]
 */
export function getRecommendations(confirmedIntent, personaId, connectedMcpServers = []) {
  if (!confirmedIntent) return { recommendations: [] };

  const persona = getPersonaById(personaId);
  const personaTags = persona ? persona.workflowTags : [];
  const keywords = extractKeywords(confirmedIntent);

  // Score all skills
  const scoredSkills = SKILLS.map(skill => {
    const baseScore = computeTagOverlap(keywords, skill.tags);
    const boost = hasTagOverlap(personaTags, skill.tags) ? 1.2 : 1.0;
    const finalScore = Math.min(baseScore * boost, 1.0);

    return {
      id:        skill.id,
      type:      'skill',
      name:      skill.name,
      rationale: buildSkillRationale(skill, keywords, confirmedIntent),
      score:     finalScore
    };
  }).filter(r => r.score > 0.05);

  // Score connected MCP servers
  const scoredMcp = connectedMcpServers.map(server => {
    const serverTags = Array.isArray(server.tags) ? server.tags : [];
    const baseScore = computeTagOverlap(keywords, serverTags);
    const boost = hasTagOverlap(personaTags, serverTags) ? 1.2 : 1.0;
    const finalScore = Math.min(baseScore * boost, 1.0);

    return {
      id:        server.id,
      type:      'mcp-server',
      name:      server.name,
      rationale: buildMcpRationale(server, keywords),
      score:     finalScore
    };
  }).filter(r => r.score > 0.05);

  // Merge, sort by score descending, take top 3
  const all = [...scoredSkills, ...scoredMcp]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return { recommendations: all };
}

/**
 * Record user acceptance of a recommendation.
 * @param {string} recommendationId
 * @returns {{ status: 'accepted' }}
 */
export function acceptRecommendation(recommendationId) {
  _acceptanceLog.set(recommendationId, 'accepted');
  return { status: 'accepted' };
}

/**
 * Record user override of a recommendation.
 * @param {string} recommendationId - The original recommended item
 * @param {string} userSelectedId - The item the user chose instead
 * @returns {{ status: 'overridden' }}
 */
export function overrideRecommendation(recommendationId, userSelectedId) {
  _acceptanceLog.set(recommendationId, 'overridden');
  // In a production system, this data would be sent to a feedback endpoint
  return { status: 'overridden' };
}

/**
 * Get the selected workflow for use in the answer generation prompt.
 * @param {string} workflowId
 * @returns {object|null} The skill or MCP server object
 */
export function getWorkflowById(workflowId) {
  // Check skills first
  const skill = getSkillById(workflowId);
  if (skill) return { ...skill, type: 'skill' };
  return null;
}

/**
 * Build an augmented system prompt that incorporates the selected workflow.
 * @param {string} baseSystemPrompt - The persona's system prompt
 * @param {object} workflow - Selected skill or MCP server
 * @param {string} confirmedIntent - The resolved intent
 * @returns {string}
 */
export function buildWorkflowAugmentedPrompt(baseSystemPrompt, workflow, confirmedIntent) {
  if (!workflow) return baseSystemPrompt;

  const workflowContext = workflow.type === 'skill'
    ? `\n\nWORKFLOW SELECTED: ${workflow.name}\n${workflow.description}\nApply this workflow to address the user's confirmed intent: "${confirmedIntent}"`
    : `\n\nCONNECTED TOOL: ${workflow.name}\n${workflow.description || ''}\nUse this tool where relevant to address: "${confirmedIntent}"`;

  return baseSystemPrompt + workflowContext;
}

// ── Scoring helpers ───────────────────────────────────────────────────────────

/**
 * Extract keywords from an intent string.
 * Filters stopwords and returns meaningful terms.
 */
function extractKeywords(intent) {
  const STOPWORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
    'user', 'needs', 'help', 'want', 'wants', 'need', 'their', 'my', 'me',
    'i', 'we', 'you', 'it', 'they', 'us'
  ]);

  return intent
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * Compute tag overlap score between keywords and an item's tags.
 * Returns 0–1.
 */
function computeTagOverlap(keywords, tags) {
  if (!keywords.length || !tags.length) return 0;

  const tagSet = new Set(tags.map(t => t.toLowerCase().replace(/-/g, ' ')));
  const tagWords = new Set(tags.flatMap(t => t.toLowerCase().split('-')));

  let score = 0;
  for (const kw of keywords) {
    const normalized = kw.replace(/-/g, ' ');
    // Exact tag match (higher weight)
    if (tagSet.has(normalized)) {
      score += 1.5;
      continue;
    }
    // Tag contains keyword or keyword is in tag words
    if (tagWords.has(kw) || tags.some(t => t.toLowerCase().includes(kw))) {
      score += 1.0;
    }
  }

  // Normalize by number of keywords
  return Math.min(score / (keywords.length * 1.5), 1.0);
}

/**
 * Check if two tag arrays share any elements.
 */
function hasTagOverlap(tagsA, tagsB) {
  if (!tagsA.length || !tagsB.length) return false;
  const setA = new Set(tagsA.map(t => t.toLowerCase()));
  return tagsB.some(t => setA.has(t.toLowerCase()));
}

/**
 * Build a human-readable rationale for a skill recommendation.
 */
function buildSkillRationale(skill, keywords, intent) {
  const matchingTags = skill.tags.filter(tag =>
    keywords.some(kw => tag.toLowerCase().includes(kw) || kw.includes(tag.toLowerCase()))
  );

  if (matchingTags.length > 0) {
    return `Matches "${matchingTags.slice(0, 2).join(', ')}" in your query`;
  }
  return skill.description.split('.')[0];
}

/**
 * Build a human-readable rationale for an MCP server recommendation.
 */
function buildMcpRationale(server, keywords) {
  const matchingTags = (server.tags || []).filter(tag =>
    keywords.some(kw => tag.toLowerCase().includes(kw) || kw.includes(tag.toLowerCase()))
  );

  if (matchingTags.length > 0) {
    return `Connected tool matching "${matchingTags.slice(0, 2).join(', ')}"`;
  }
  return server.description ? server.description.split('.')[0] : `Connected MCP server: ${server.name}`;
}
