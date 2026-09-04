/**
 * Clarification Engine
 *
 * Injects a clarification gate into every persona's system prompt.
 * Before answering any user query, the AI assesses whether clarifying
 * questions are needed. If so, it returns a structured JSON response
 * with questions. Once answered, it resolves the confirmed intent.
 *
 * Response format when clarification needed:
 *   {"clarify": true, "questions": ["Q1", "Q2", "Q3"]}
 *
 * Response format when no clarification needed:
 *   {"clarify": false, "confirmedIntent": "...intent summary..."}
 */

import { getPersonaById } from '../personas/registry.js';

// ── Gate system prompt prefix ─────────────────────────────────────────────────

const CLARIFICATION_GATE_PREFIX = `CLARIFICATION GATE (follow this before every response):

Before answering any user query, assess whether the query is ambiguous, incomplete, or could have multiple valid interpretations.

If the query IS ambiguous or needs clarification (most complex queries):
- Respond with ONLY this JSON (no other text):
{"clarify": true, "questions": ["Question 1?", "Question 2?", "Question 3?"]}
- Ask 1–3 targeted questions that will materially improve your answer
- Questions must be specific and answerable in a few words
- Do NOT ask obvious or unnecessary questions

If the query is fully self-contained and unambiguous:
- Respond with ONLY this JSON (no other text):
{"clarify": false, "confirmedIntent": "One sentence summary of what the user wants to achieve"}

CRITICAL: Your ENTIRE response for this first assessment must be valid JSON only. No explanations, no markdown, no other text. Just the JSON object.

After clarification is resolved, you will receive the confirmed intent and can provide your full expert response.

---

`;

const RESOLVE_INTENT_PREFIX = `Based on the following clarification exchange, synthesize a clear, specific confirmed intent summary.

Return ONLY this JSON (no other text):
{"confirmedIntent": "Specific, actionable description of what the user needs"}

The intent should:
- Be specific enough to guide an expert response
- Include key constraints and requirements revealed through clarification
- Be written from the perspective of what the user needs to accomplish

---

`;

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Assess whether a query needs clarification.
 * Calls the active AI provider with a clarification gate prefix.
 *
 * @param {string} query - The user's query
 * @param {string} personaId - Active persona ID
 * @param {object[]} conversationHistory - Prior messages [{role, content}]
 * @param {object} providerClient - Active provider client with .complete() method
 * @returns {Promise<{clarify: boolean, questions?: string[], confirmedIntent?: string}>}
 */
export async function assessQuery(query, personaId, conversationHistory, providerClient) {
  const persona = getPersonaById(personaId);
  if (!persona) throw new Error(`Unknown persona: ${personaId}`);

  // Build the gated system prompt
  const systemPrompt = CLARIFICATION_GATE_PREFIX + persona.systemPrompt;

  // Only include recent conversation context (last 4 messages) to keep prompt short
  const recentHistory = conversationHistory.slice(-4);

  const messages = [
    ...recentHistory,
    { role: 'user', content: query }
  ];

  try {
    const rawResponse = await providerClient.complete({
      systemPrompt,
      messages,
      maxTokens: 256,  // Small — just need the JSON
      temperature: 0   // Deterministic for structured output
    });

    return parseClarificationResponse(rawResponse);
  } catch (err) {
    // If parsing fails or API error, skip clarification and proceed
    console.warn('[ClarificationEngine] assessQuery failed, skipping clarification:', err.message);
    return { clarify: false, confirmedIntent: query };
  }
}

/**
 * Resolve confirmed intent from a clarification Q&A exchange.
 *
 * @param {string[]} questions - Questions that were asked
 * @param {string[]} answers - User's answers (parallel array)
 * @param {string} personaId - Active persona ID
 * @param {object} providerClient - Active provider client
 * @returns {Promise<{confirmedIntent: string}>}
 */
export async function resolveIntent(questions, answers, personaId, providerClient) {
  const persona = getPersonaById(personaId);
  if (!persona) throw new Error(`Unknown persona: ${personaId}`);

  // Format the Q&A exchange
  const qaText = questions.map((q, i) =>
    `Q: ${q}\nA: ${answers[i] || '(no answer provided)'}`
  ).join('\n\n');

  const systemPrompt = RESOLVE_INTENT_PREFIX + `Expert context: ${persona.name} — ${persona.tagline}`;

  const messages = [
    { role: 'user', content: `Clarification exchange:\n\n${qaText}` }
  ];

  try {
    const rawResponse = await providerClient.complete({
      systemPrompt,
      messages,
      maxTokens: 256,
      temperature: 0
    });

    const parsed = parseJsonResponse(rawResponse);
    if (parsed && parsed.confirmedIntent) {
      return { confirmedIntent: parsed.confirmedIntent };
    }

    // Fallback: synthesize from answers
    return { confirmedIntent: synthesizeIntentFromAnswers(questions, answers) };
  } catch (err) {
    console.warn('[ClarificationEngine] resolveIntent failed:', err.message);
    return { confirmedIntent: synthesizeIntentFromAnswers(questions, answers) };
  }
}

/**
 * Check if a follow-up message contains ambiguity signals
 * that warrant re-triggering the clarification gate.
 *
 * @param {string} message - User's follow-up message
 * @returns {boolean}
 */
export function hasAmbiguitySignals(message) {
  const text = message.toLowerCase();
  const ambiguityPatterns = [
    /\b(also|and also|one more|another thing|different|change|instead|actually)\b/,
    /\b(can you (also|now|instead))\b/,
    /\b(what about|how about)\b/,
    /\b(totally different|new topic|new question|unrelated)\b/,
    /\b(forget|ignore|never mind|start over)\b/
  ];
  return ambiguityPatterns.some(p => p.test(text));
}

// ── Parsing helpers ───────────────────────────────────────────────────────────

function parseClarificationResponse(raw) {
  const parsed = parseJsonResponse(raw);

  if (!parsed) {
    // Could not parse JSON — default to no clarification needed
    return { clarify: false, confirmedIntent: '' };
  }

  if (parsed.clarify === true && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
    return {
      clarify: true,
      questions: parsed.questions.slice(0, 3) // Max 3 questions
    };
  }

  if (parsed.clarify === false) {
    return {
      clarify: false,
      confirmedIntent: parsed.confirmedIntent || ''
    };
  }

  // Unexpected structure — treat as no clarification needed
  return { clarify: false, confirmedIntent: '' };
}

function parseJsonResponse(raw) {
  if (!raw || typeof raw !== 'string') return null;

  // Try to extract JSON from the response (may have surrounding whitespace or markdown)
  const cleaned = raw.trim();

  // Direct parse
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to find JSON object in the string
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function synthesizeIntentFromAnswers(questions, answers) {
  // Build a simple intent summary from the Q&A without an API call
  const parts = answers.filter(a => a && a.trim()).slice(0, 3);
  if (parts.length === 0) return 'User needs help with their request';
  return `User needs help with: ${parts.join('; ')}`;
}
