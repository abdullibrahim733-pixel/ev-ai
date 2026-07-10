// ═══════════════════════════════════════════════════════
// EV-AI — Main Sketch (Backend-Connected)
// p5.js WEBGL 3D renderer + Python Backend Bridge
// ═══════════════════════════════════════════════════════

// ─── Configuration ────────────────────────────
const CONFIG = {
  backendUrl: window.location.origin.includes('localhost')
    ? 'http://localhost:8000'
    : window.location.origin,  // Try same origin for Pages deployed backend
  useBackend: true,
  pollInterval: 500,  // ms between status polls
};

let ev, ai;
let paused = false;
let cameraMode = 0;
let orbitAngle = 0;
let showGrid = true;
let lastPoll = 0;

// ─── p5.js Setup ──────────────────────────────
function setup() {
  const container = document.getElementById('p5-canvas-wrapper');
  const canvasWidth = container.offsetWidth || windowWidth;
  const canvasHeight = container.offsetHeight || 500;

  const canvas = createCanvas(canvasWidth, canvasHeight, WEBGL);
  canvas.parent('p5-canvas-wrapper');
  pixelDensity(1);

  // Create EV and AI
  ev = new EVModel();
  ai = new AIAgent(ev);

  // Random starting position on track
  ev.pos = ai.waypoints[0].copy();
  ev.rotation = random(TWO_PI);

  setCamera();
  setupUIEvents();

  // Test backend connection
  testBackend();
}

async function testBackend() {
  try {
    const resp = await fetch(`${CONFIG.backendUrl}/api/health`, {
      signal: AbortSignal.timeout(2000)
    });
    const data = await resp.json();
    CONFIG.useBackend = data.status === 'healthy';
    console.log(`[EV-AI] Backend connected: ${CONFIG.useBackend}`);
    document.getElementById('sb-message').textContent = CONFIG.useBackend
      ? 'Backend connected ✓'
      : 'Standalone mode';
  } catch (e) {
    CONFIG.useBackend = false;
    console.log('[EV-AI] No backend, running standalone');
    document.getElementById('sb-message').textContent = 'Standalone mode';
  }
}

// ─── Draw Loop ─────────────────────────────────
function draw() {
  const dt = min(deltaTime / 1000, 0.05);

  // Update physics
  if (!paused) {
    ai.tick(dt);
  }

  // Poll backend periodically
  if (CONFIG.useBackend && millis() - lastPoll > CONFIG.pollInterval) {
    lastPoll = millis();
    pollBackend();
  }

  // ─── Rendering ────────────────────────────
  background(8, 8, 25);
  ambientLight(50, 50, 85);
  directionalLight(160, 160, 200, 0.5, -0.8, -0.3);
  ambientMaterial(100, 100, 140);

  setCamera();

  // Ground
  push();
  noStroke();
  fill(10, 10, 30);
  translate(0, -0.05, 0);
  box(60, 0.1, 60);
  pop();

  // Grid
  if (showGrid) {
    push();
    stroke(0, 229, 255, 14);
    strokeWeight(0.04);
    noFill();
    for (let i = -30; i <= 30; i += 3) {
      line(i, 0.01, -30, i, 0.01, 30);
      line(-30, 0.01, i, 30, 0.01, i);
    }
    pop();
  }

  // Track path
  push();
  noFill();
  stroke(0, 229, 255, 20);
  strokeWeight(0.06);
  ellipse(0, 0, 24, 16.8);
  pop();

  // Waypoints
  push();
  noFill();
  stroke(255, 255, 255, 10);
  strokeWeight(0.03);
  beginShape(POINTS);
  for (let i = 0; i < ai.waypoints.length; i++) {
    vertex(ai.waypoints[i].x, ai.waypoints[i].z);
  }
  endShape();
  pop();

  // AI Sensors visualization
  ai.renderDebug();

  // EV model
  ev.render();

  // ─── UI Updates ───────────────────────────
  updateUI();
}

// ─── Backend Polling ───────────────────────────
async function pollBackend() {
  try {
    const resp = await fetch(`${CONFIG.backendUrl}/api/status`, {
      signal: AbortSignal.timeout(1000)
    });
    const state = await resp.json();

    // Sync AI state from backend
    if (state) {
      ai.state = state.state;
      ai.decision = state.decision;
      ai.confidence = state.confidence;
      ai.currentWaypoint = state.waypoint;
      ev.battery = state.battery;

      // Sync obstacles
      if (state.obstacles_detected > 0) {
        while (ai.detectedObstacles.length < state.obstacles_detected) {
          ai.detectedObstacles.push({
            pos: createVector(random(-10, 10), 0, random(-10, 10)),
            radius: random(0.3, 0.8)
          });
        }
      }
    }
  } catch (e) {
    // Backend went down, fall back to standalone
    if (CONFIG.useBackend) {
      console.log('[EV-AI] Backend lost, falling back to standalone');
      CONFIG.useBackend = false;
      document.getElementById('sb-message').textContent = 'Standalone (backend lost)';
    }
  }
}

// ─── Camera Controller ─────────────────────────
function setCamera() {
  const target = ev ? ev.pos : createVector(0, 0, 0);
  const rot = ev ? ev.rotation : 0;

  switch (cameraMode) {
    case 0: // Chase
      const cd = 8, ch = 4;
      camera(target.x - cos(rot)*cd, ch, target.z - sin(rot)*cd,
             target.x, 0.5, target.z, 0, 1, 0);
      break;
    case 1: // Top-down
      camera(target.x, 22, target.z + 0.1, target.x, 0, target.z, 0, 0, -1);
      break;
    case 2: // Orbit
      orbitAngle += 0.005;
      camera(target.x + cos(orbitAngle)*15, 8, target.z + sin(orbitAngle)*15,
             target.x, 0.5, target.z, 0, 1, 0);
      break;
    case 3: // First-person
      const fX = target.x + cos(rot)*1.5;
      const fZ = target.z + sin(rot)*1.5;
      const fY = ev ? ev.height * 0.5 : 1;
      camera(fX, fY, fZ,
             target.x + cos(rot)*5, fY-0.2, target.z + sin(rot)*5,
             0, 1, 0);
      break;
  }
}

// ─── Window Resize ─────────────────────────────
function windowResized() {
  const container = document.getElementById('p5-canvas-wrapper');
  resizeCanvas(container.offsetWidth || windowWidth,
               container.offsetHeight || 500);
}

// ═══════════════════════════════════════════════════
// PROFESSIONAL UI UPDATES
// ═══════════════════════════════════════════════════

function updateUI() {
  if (!ev) return;

  const speedKmh = round(constrain(ev.speed * 3.6, 0, 999));
  const batteryPct = round(constrain(ev.battery, 0, 100));

  // ─── Gauges ──────────────────────────────
  const speedOffset = map(speedKmh, 0, 180, 264, 0);
  const speedFill = document.getElementById('gauge-speed-fill');
  if (speedFill) {
    speedFill.style.strokeDashoffset = Math.max(0, speedOffset);
    speedFill.style.stroke = speedKmh > 100 ? '#ff1744' : speedKmh > 60 ? '#ff9100' : '#00e676';
  }
  setText('speed-gauge-val', speedKmh);

  const batOffset = map(batteryPct, 0, 100, 264, 0);
  const batFill = document.getElementById('gauge-battery-fill');
  if (batFill) {
    batFill.style.strokeDashoffset = Math.max(0, batOffset);
    batFill.style.stroke = batteryPct < 20 ? '#ff1744' : batteryPct < 40 ? '#ff9100' : '#00e5ff';
  }
  setText('battery-gauge-val', batteryPct);

  // Viewport HUD
  const vpdSpeed = document.getElementById('vpd-speed-val');
  if (vpdSpeed) {
    vpdSpeed.textContent = speedKmh;
    vpdSpeed.style.color = speedKmh > 100 ? '#ff1744' : speedKmh > 60 ? '#ff9100' : '#00e676';
  }

  const vpdBat = document.getElementById('vpd-bat-fill');
  if (vpdBat) {
    vpdBat.style.width = `${batteryPct}%`;
    vpdBat.style.background = batteryPct < 20 ? '#ff1744' : batteryPct < 40 ? '#ff9100' : '#00e5ff';
  }

  // ─── Metrics ──────────────────────────────
  const steerDeg = round(degrees(ev.steerAngle));
  const range = round((ev.battery / 100) * ev.batteryRange);

  setText('metric-steering', `${steerDeg}°`);
  setText('metric-range', `${range} km`);
  setText('metric-waypoint', `${ai.currentWaypoint} / ${ai.waypoints.length}`);
  setText('metric-confidence', `${round(ai.confidence * 100)}%`);
  setText('metric-frametime', `${round(deltaTime)}ms`);
  setText('metric-obstacles', `${ai.detectedObstacles.length} detected`);
  setText('metric-ai-mode', ai.state);
  setText('metric-decision', ai.decision);
  setText('metric-control', 'Pure Pursuit');
  setText('metric-steer-out', ai.steerOutput.toFixed(2));
  setText('metric-throttle', ai.throttleOutput.toFixed(2));
  setText('metric-brake', ai.brakeOutput.toFixed(2));

  // ─── Sensor Dots ──────────────────────────
  const sensorIds = { fl: 's-fl', fm: 's-fm', fr: 's-fr',
                      sl: 's-sl', sr: 's-sr',
                      rl: 's-rl', rm: 's-rm', rr: 's-rr' };
  for (const [key, elId] of Object.entries(sensorIds)) {
    const el = document.getElementById(elId);
    if (!el) continue;
    const s = ai.sensors[key];
    el.className = 'sensor-dot';
    if (s.active && s.distance < s.range * 0.3) el.classList.add('danger');
    else if (s.active) el.classList.add('warning');
    else if (s.distance < s.range * 0.8) el.classList.add('active');
  }

  // ─── Status Bar ───────────────────────────
  setText('sb-coords', `X: ${ev.pos.x.toFixed(1)}  Y: 0.0  Z: ${ev.pos.z.toFixed(1)}`);
  const camNames = ['Chase', 'Top-Down', 'Orbit', 'First-Person'];
  setText('sb-camera', `Camera: ${camNames[cameraMode]}`);
  setText('sb-fps', `${round(frameRate())} FPS`);

  // ─── AI State Badge ───────────────────────
  const badge = document.getElementById('badge-state');
  if (badge) {
    const dot = badge.querySelector('.state-dot');
    const label = badge.textContent;
    // Keep the dot, update text
    badge.textContent = ai.state;
    if (dot) badge.prepend(dot);
  }

  // ─── Status Badge ─────────────────────────
  const statusEl = document.getElementById('status-indicator');
  if (statusEl) {
    if (ai.state.includes('Avoid') || ai.state.includes('Braking')) {
      statusEl.className = 'status-badge status-danger';
      statusEl.innerHTML = '<span class="status-dot"></span> ⚠ AVOIDING';
    } else if (ev.battery < 5) {
      statusEl.className = 'status-badge status-danger';
      statusEl.innerHTML = '<span class="status-dot"></span> 🔋 LOW BATTERY';
    } else {
      statusEl.className = 'status-badge status-autonomous';
      statusEl.innerHTML = '<span class="status-dot"></span> ● AUTONOMOUS';
    }
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ═══════════════════════════════════════════════════
// UI EVENTS
// ═══════════════════════════════════════════════════

function setupUIEvents() {
  // ─── Action Buttons ───────────────────────
  const toggleBtn = document.getElementById('btn-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      paused = !paused;
      toggleBtn.querySelector('span').textContent = paused ? 'Play' : 'Pause';
      toggleBtn.querySelector('svg').innerHTML = paused
        ? '<polygon points="5,3 19,12 5,21" fill="currentColor"/>'
        : '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    });
  }

  const resetBtn = document.getElementById('btn-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      ev.pos = ai.waypoints[0].copy();
      ev.rotation = 0;
      ev.speed = 0;
      ev.battery = 85;
      ai.currentWaypoint = 0;
      ai.lastDistances = [];
      ai.detectedObstacles = [];
      paused = false;
      if (toggleBtn) {
        toggleBtn.querySelector('span').textContent = 'Pause';
        toggleBtn.querySelector('svg').innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
      }
      // Reset on backend too
      if (CONFIG.useBackend) {
        fetch(`${CONFIG.backendUrl}/api/control`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({action: 'reset'})
        }).catch(() => {});
      }
    });
  }

  const camBtn = document.getElementById('btn-camera');
  if (camBtn) {
    camBtn.addEventListener('click', () => {
      cameraMode = (cameraMode + 1) % 4;
      const names = ['Chase', 'Top-Down', 'Orbit', 'First-Person'];
      camBtn.querySelector('span').textContent = names[cameraMode];
    });
  }

  // ─── Panel Tabs ──────────────────────────
  document.querySelectorAll('.panel-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel-content').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const pane = document.getElementById(`tab-${tab.dataset.tab}`);
      if (pane) pane.classList.add('active');
    });
  });

  // ─── Toolbar ──────────────────────────────
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  const toolReset = document.getElementById('tool-reset');
  if (toolReset) toolReset.addEventListener('click', () => { cameraMode = 0; });

  const toolGrid = document.getElementById('tool-grid');
  if (toolGrid) {
    toolGrid.addEventListener('click', () => {
      showGrid = !showGrid;
      toolGrid.classList.toggle('active');
    });
  }

  const toolScreenshot = document.getElementById('tool-screenshot');
  if (toolScreenshot) {
    toolScreenshot.addEventListener('click', () => {
      const c = document.querySelector('canvas');
      if (c) {
        const link = document.createElement('a');
        link.download = `ev-ai-${Date.now()}.png`;
        link.href = c.toDataURL('image/png');
        link.click();
      }
    });
  }

  const toolFullscreen = document.getElementById('tool-fullscreen');
  if (toolFullscreen) {
    toolFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.body.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen();
      }
    });
  }

  // ─── Keyboard shortcuts ──────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Space') {
      e.preventDefault();
      document.getElementById('btn-toggle')?.click();
    }
    if (e.key === 'r' || e.key === 'R') document.getElementById('btn-reset')?.click();
    if (e.key === 'c' || e.key === 'C') document.getElementById('btn-camera')?.click();
    if (e.key === 'g' || e.key === 'G') document.getElementById('tool-grid')?.click();
    if (e.key === 'f' || e.key === 'F') document.getElementById('tool-fullscreen')?.click();
  });
}
