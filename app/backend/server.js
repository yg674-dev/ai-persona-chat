/**
 * persona.ai Backend Proxy
 *
 * Express server providing:
 * - GET /api/health — health check
 * - GET /api/mcp/discover?topic= — MCP server discovery
 * - GET /api/mcp/cache/clear — cache management (admin/debug)
 *
 * Deployment: Vercel (serverless) or Node.js process
 * CORS: restricted to FRONTEND_ORIGIN env var
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// ── CORS ──────────────────────────────────────────────────────────────────────
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://yg674-dev.github.io';

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (curl, mobile apps, same-origin)
    if (!origin) return callback(null, true);

    const allowed = [
      FRONTEND_ORIGIN,
      'http://localhost:3000',
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://127.0.0.1:3000',
    ];

    if (allowed.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// ── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'persona-ai-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ── MCP DISCOVERY ROUTES ──────────────────────────────────────────────────────
const mcpDiscoveryRouter = require('./routes/mcp-discovery');
app.use('/api/mcp', mcpDiscoveryRouter);

// ── ERROR HANDLER ─────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);

  if (err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({ error: 'cors_blocked', message: err.message });
  }

  res.status(500).json({
    error: 'internal_error',
    message: process.env.NODE_ENV === 'production'
      ? 'An internal error occurred.'
      : err.message
  });
});

// ── 404 HANDLER ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'not_found', message: `Route ${req.path} not found` });
});

// ── START ─────────────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[persona.ai backend] Listening on http://localhost:${PORT}`);
    console.log(`[persona.ai backend] FRONTEND_ORIGIN: ${FRONTEND_ORIGIN}`);
  });
}

// Export for Vercel serverless
module.exports = app;
