/**
 * MCP Runtime Connector
 *
 * Manages the session-scoped list of connected MCP servers.
 * Servers can be connected (from discovery or manual config) and disconnected.
 * State is held in memory for the current session only.
 */

// ── Session-scoped connected server list ──────────────────────────────────────
/** @type {Map<string, McpServer>} */
const _connectedServers = new Map();

// Event listeners for UI updates
const _listeners = new Set();

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Connect an MCP server for this session.
 *
 * @param {object} server - McpServer object to connect
 * @param {string} server.id
 * @param {string} server.name
 * @param {string} server.description
 * @param {string[]} server.tags
 * @param {string} [server.installCommand]
 * @param {string} [server.sourceUrl]
 * @returns {{ status: 'connected', server: object }}
 */
export function connectServer(server) {
  if (!server || !server.id) {
    throw new Error('connectServer: server must have an id');
  }

  const connected = {
    ...server,
    status: 'connected',
    connectedAt: new Date().toISOString()
  };

  _connectedServers.set(server.id, connected);
  _notifyListeners({ type: 'connect', server: connected });

  return { status: 'connected', server: connected };
}

/**
 * Disconnect an MCP server from this session.
 *
 * @param {string} serverId - The ID of the server to disconnect
 * @returns {{ status: 'disconnected' | 'not_found' }}
 */
export function disconnectServer(serverId) {
  if (!_connectedServers.has(serverId)) {
    return { status: 'not_found' };
  }

  const server = _connectedServers.get(serverId);
  _connectedServers.delete(serverId);
  _notifyListeners({ type: 'disconnect', serverId, server });

  return { status: 'disconnected' };
}

/**
 * Get all currently connected MCP servers.
 * @returns {object[]}
 */
export function getConnectedServers() {
  return Array.from(_connectedServers.values());
}

/**
 * Check if a specific server is connected.
 * @param {string} serverId
 * @returns {boolean}
 */
export function isServerConnected(serverId) {
  return _connectedServers.has(serverId);
}

/**
 * Get a connected server by ID.
 * @param {string} serverId
 * @returns {object|null}
 */
export function getConnectedServer(serverId) {
  return _connectedServers.get(serverId) || null;
}

/**
 * Clear all connected servers (e.g. on persona switch or session clear).
 */
export function clearConnectedServers() {
  const servers = Array.from(_connectedServers.values());
  _connectedServers.clear();
  _notifyListeners({ type: 'clear', servers });
}

/**
 * Subscribe to connection state changes.
 * @param {function} listener - Called with { type, server?, serverId? }
 * @returns {function} Unsubscribe function
 */
export function onConnectionChange(listener) {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

// ── Internal ──────────────────────────────────────────────────────────────────

function _notifyListeners(event) {
  _listeners.forEach(fn => {
    try { fn(event); } catch (e) { /* ignore listener errors */ }
  });
}
