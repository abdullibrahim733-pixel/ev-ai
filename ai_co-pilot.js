// ════════════════════════════════════════════════
// EV-AI — AI Co-pilot Chat (Google AI / Gemini)
// Conversational interface to the simulation
// ════════════════════════════════════════════════

(function() {
  'use strict';

  const BACKEND_URL = (window.location.origin.includes('localhost')
    ? 'http://localhost:8000'
    : window.location.origin);

  let initialized = false;
  let messagesEl, inputEl, sendBtn, statusEl;

  // ─── Init — wait for DOM ──────────────────────
  function init() {
    if (initialized) return;
    messagesEl = document.getElementById('copilot-messages');
    inputEl = document.getElementById('copilot-input');
    sendBtn = document.getElementById('copilot-send');
    statusEl = document.getElementById('copilot-status');

    if (!messagesEl || !inputEl || !sendBtn) {
      setTimeout(init, 500);
      return;
    }

    sendBtn.addEventListener('click', handleSend);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSend();
    });

    // Check API health
    checkApiStatus();
    initialized = true;
  }

  // ─── Check if backend + Gemini API are available ──
  async function checkApiStatus() {
    try {
      const resp = await fetch(`${BACKEND_URL}/api/health`, {
        signal: AbortSignal.timeout(3000)
      });
      const data = await resp.json();
      if (data.status === 'healthy') {
        statusEl.textContent = 'API: connected ✓';
        statusEl.style.color = '#00e676';
      } else {
        statusEl.textContent = 'API: backend unreachable';
        statusEl.style.color = '#ff9100';
      }
    } catch (e) {
      statusEl.textContent = 'API: offline (standalone mode)';
      statusEl.style.color = '#ff1744';
    }
  }

  // ─── Collect simulation telemetry ──────────────
  function getTelemetryContext() {
    // Access global ai and ev from sketch.js
    if (typeof ai === 'undefined' || typeof ev === 'undefined') {
      return null;
    }

    const sensors = {};
    for (const [key, s] of Object.entries(ai.sensors || {})) {
      sensors[key] = {
        distance: s.distance,
        active: s.active,
        range: s.range,
      };
    }

    return {
      speed: ev.speed || 0,
      battery: ev.battery || 85,
      state: ai.state || 'Path Following',
      decision: ai.decision || 'Following path',
      waypoint: ai.currentWaypoint || 0,
      totalWaypoints: ai.waypoints ? ai.waypoints.length : 64,
      confidence: ai.confidence || 0.95,
      sensors: sensors,
    };
  }

  // ─── Send message to AI Co-pilot ──────────────
  async function handleSend() {
    const text = inputEl.value.trim();
    if (!text) return;

    // Disable input, show sending
    inputEl.disabled = true;
    sendBtn.disabled = true;
    sendBtn.textContent = '...';

    // Add user message to chat
    addMessage('user', text);
    inputEl.value = '';

    try {
      const context = getTelemetryContext();

      const resp = await fetch(`${BACKEND_URL}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context: context,
        }),
        signal: AbortSignal.timeout(15000),
      });

      const data = await resp.json();

      if (data.reply) {
        addMessage('ai', data.reply);
      } else if (data.error) {
        addMessage('system', `Error: ${data.error}`);
      }
    } catch (e) {
      if (e.name === 'TimeoutError') {
        addMessage('system', '⏱ Request timed out. Is the API key configured?');
      } else {
        addMessage('system', `⚠ Connection error: ${e.message}`);
      }
    } finally {
      inputEl.disabled = false;
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send';
      inputEl.focus();
    }
  }

  // ─── Add a message to the chat window ──────────
  function addMessage(type, text) {
    const div = document.createElement('div');
    div.className = `copilot-msg ${type}`;
    div.style.cssText = 'padding:4px 0; font-size:12px; line-height:1.5;';

    const prefix = type === 'user'
      ? '<span style="color:#e0e0f0; font-weight:600;">You</span> '
      : type === 'ai'
        ? '<span style="color:#00e5ff; font-weight:600;">Co-pilot</span> '
        : '<span style="color:#8888aa;">System</span> ';

    div.innerHTML = prefix + escapeHtml(text);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ─── Simple HTML escaping ──────────────────────
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ─── Start ─────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
