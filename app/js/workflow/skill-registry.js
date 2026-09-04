/**
 * Skill Registry
 *
 * Hardcoded registry of Claude Code skills available for workflow recommendation.
 * Each skill has an id, name, description, and tags array used for tag-based matching.
 *
 * In a real Claude Code environment these would be read from .claude/commands/*.md
 * frontmatter. For browser use, we maintain a curated list here.
 */

/**
 * @typedef {object} Skill
 * @property {string} id - Unique slug
 * @property {string} name - Display name
 * @property {string} description - What this skill does
 * @property {string[]} tags - Semantic tags for matching
 * @property {string} [category] - Optional grouping category
 */

/** @type {Skill[]} */
export const SKILLS = [
  // ── Code Quality ─────────────────────────────────────────────────────────────
  {
    id: 'code-review',
    name: 'Code Review',
    description: 'Systematic code review with focus on quality, best practices, security, and performance.',
    tags: ['code-review', 'debugging', 'quality', 'best-practices', 'security', 'performance', 'refactoring'],
    category: 'Code Quality'
  },
  {
    id: 'debug',
    name: 'Debug',
    description: 'Systematic debugging workflow: reproduce, isolate, identify root cause, and fix.',
    tags: ['debugging', 'error', 'bug', 'troubleshooting', 'testing', 'code-review'],
    category: 'Code Quality'
  },
  {
    id: 'refactor',
    name: 'Refactor',
    description: 'Improve code structure, readability, and maintainability without changing behavior.',
    tags: ['refactoring', 'code-review', 'architecture', 'clean-code', 'performance'],
    category: 'Code Quality'
  },
  {
    id: 'test-coverage',
    name: 'Test Coverage',
    description: 'Analyze test coverage gaps and write missing unit, integration, and E2E tests.',
    tags: ['testing', 'tdd', 'qa', 'unit-tests', 'automation', 'code-review'],
    category: 'Code Quality'
  },

  // ── Architecture ──────────────────────────────────────────────────────────────
  {
    id: 'system-design',
    name: 'System Design',
    description: 'Design scalable, reliable system architectures with trade-off analysis.',
    tags: ['architecture', 'system-design', 'scalability', 'distributed-systems', 'cloud'],
    category: 'Architecture'
  },
  {
    id: 'api-design',
    name: 'API Design',
    description: 'Design clean, consistent REST or GraphQL APIs with proper versioning and error handling.',
    tags: ['api-design', 'rest', 'graphql', 'architecture', 'documentation'],
    category: 'Architecture'
  },
  {
    id: 'database-design',
    name: 'Database Design',
    description: 'Schema design, indexing strategy, and query optimization for SQL and NoSQL databases.',
    tags: ['database', 'sql', 'schema', 'performance', 'data-engineering'],
    category: 'Architecture'
  },

  // ── DevOps ────────────────────────────────────────────────────────────────────
  {
    id: 'ci-cd-setup',
    name: 'CI/CD Setup',
    description: 'Design and implement CI/CD pipelines with GitHub Actions, GitLab CI, or Jenkins.',
    tags: ['ci-cd', 'devops', 'automation', 'testing', 'deployment'],
    category: 'DevOps'
  },
  {
    id: 'docker-compose',
    name: 'Docker Compose',
    description: 'Create Docker and Docker Compose configurations for development and production.',
    tags: ['devops', 'docker', 'containers', 'infrastructure'],
    category: 'DevOps'
  },
  {
    id: 'infrastructure-as-code',
    name: 'Infrastructure as Code',
    description: 'Write Terraform, Pulumi, or CloudFormation for reproducible infrastructure.',
    tags: ['terraform', 'infrastructure', 'cloud', 'devops', 'automation'],
    category: 'DevOps'
  },

  // ── Data & ML ─────────────────────────────────────────────────────────────────
  {
    id: 'data-analysis',
    name: 'Data Analysis',
    description: 'Exploratory data analysis, statistical summaries, and visualization recommendations.',
    tags: ['data-analysis', 'statistics', 'visualization', 'python', 'machine-learning'],
    category: 'Data & ML'
  },
  {
    id: 'ml-pipeline',
    name: 'ML Pipeline',
    description: 'Design and implement end-to-end machine learning training and inference pipelines.',
    tags: ['machine-learning', 'mlops', 'modeling', 'python', 'ai-agents'],
    category: 'Data & ML'
  },
  {
    id: 'prompt-engineering',
    name: 'Prompt Engineering',
    description: 'Craft and iterate on system prompts, few-shot examples, and chain-of-thought strategies.',
    tags: ['prompt-engineering', 'llm', 'ai-agents', 'rag'],
    category: 'Data & ML'
  },
  {
    id: 'rag-setup',
    name: 'RAG Setup',
    description: 'Design and implement Retrieval-Augmented Generation systems with vector databases.',
    tags: ['rag', 'llm', 'vector-database', 'ai-agents', 'fine-tuning'],
    category: 'Data & ML'
  },

  // ── Documentation ─────────────────────────────────────────────────────────────
  {
    id: 'docs-generation',
    name: 'Documentation',
    description: 'Generate API docs, README files, inline comments, and developer guides.',
    tags: ['documentation', 'technical-writing', 'api-docs', 'developer-experience'],
    category: 'Documentation'
  },
  {
    id: 'changelog',
    name: 'Changelog',
    description: 'Generate human-readable changelogs from git commits following Keep a Changelog format.',
    tags: ['documentation', 'git', 'release', 'technical-writing'],
    category: 'Documentation'
  },

  // ── Security ──────────────────────────────────────────────────────────────────
  {
    id: 'security-audit',
    name: 'Security Audit',
    description: 'Audit code and infrastructure for OWASP Top 10, secrets exposure, and common vulnerabilities.',
    tags: ['security', 'vulnerability', 'owasp', 'compliance', 'code-review'],
    category: 'Security'
  },
  {
    id: 'threat-model',
    name: 'Threat Modeling',
    description: 'Create a STRIDE-based threat model for a system or feature.',
    tags: ['security', 'threat-modeling', 'architecture', 'compliance'],
    category: 'Security'
  },

  // ── Product & Strategy ────────────────────────────────────────────────────────
  {
    id: 'prd-writer',
    name: 'PRD Writer',
    description: 'Write a complete Product Requirements Document with user stories and acceptance criteria.',
    tags: ['product-management', 'prd', 'documentation', 'strategy'],
    category: 'Product'
  },
  {
    id: 'user-story-generator',
    name: 'User Story Generator',
    description: 'Convert feature ideas into properly formatted user stories with acceptance criteria.',
    tags: ['product-management', 'user-research', 'prd', 'agile'],
    category: 'Product'
  },
  {
    id: 'competitive-analysis',
    name: 'Competitive Analysis',
    description: 'Structure a competitive landscape analysis with feature comparison and positioning.',
    tags: ['competitive-analysis', 'strategy', 'market-entry', 'product-management'],
    category: 'Product'
  },

  // ── Content & Copy ────────────────────────────────────────────────────────────
  {
    id: 'copywriting',
    name: 'Copywriting',
    description: 'Write persuasive copy for landing pages, ads, emails, and product descriptions.',
    tags: ['copywriting', 'content', 'email', 'ads', 'brand-voice', 'conversion'],
    category: 'Content'
  },
  {
    id: 'content-strategy',
    name: 'Content Strategy',
    description: 'Build an editorial calendar, content pillars, and distribution strategy.',
    tags: ['content', 'marketing', 'seo', 'social-media', 'campaigns'],
    category: 'Content'
  }
];

/**
 * Get a skill by ID.
 * @param {string} id
 * @returns {Skill|undefined}
 */
export function getSkillById(id) {
  return SKILLS.find(s => s.id === id);
}

/**
 * Get all skills filtered by tags.
 * @param {string[]} tags
 * @returns {Skill[]}
 */
export function getSkillsByTags(tags) {
  if (!tags || tags.length === 0) return [];
  const tagSet = new Set(tags.map(t => t.toLowerCase()));
  return SKILLS.filter(skill =>
    skill.tags.some(t => tagSet.has(t.toLowerCase()))
  );
}
