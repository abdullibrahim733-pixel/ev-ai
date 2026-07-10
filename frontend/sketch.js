// ═══════════════════════════════════════════════════════
// EV-AI — Main Sketch
// p5.js WEBGL 3D renderer + Professional UI bridge
// ═══════════════════════════════════════════════════════

let ev, ai;
let paused = false;
let cameraMode = 0;  // 0=chase, 1=top, 2=orbit, 3=first-person
let orbitAngle = 0;
let showGrid = true;

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
}

// ─── Draw Loop ─────────────────────────────────
function draw() {
  const dt = min(deltaTime / 1000, 0.05);

  // Update physics
  if (!paused) {
    ai.tick(dt);
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
    stroke(0, 229, 255, 12);
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
  stroke(0, 229, 255, 18);
  strokeWeight(0.06);
  const tr = 12;
  ellipse(0, 0, tr * 2, tr * 1.4);
  pop();

  // Debug visualization
  ai.renderDebug();

  // EV model
  ev.render();

  // ─── UI Updates ───────────────────────────
  updateUI();
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
      camera(target.x, 20, target.z + 0.1, target.x, 0, target.z, 0, 0, -1);
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

  // ─── Gauges ──────────────────────────────
  const speedKmh = round(constrain(ev.speed * 3.6, 0, 999));
  const batteryPct = round(constrain(ev.battery, 0, 100));

  // Gauge circumference = 2 * PI * 42 ≈ 264
  const speedOffset = map(speedKmh, 0, 180, 264, 0);
  const speedFill = document.getElementById('gauge-speed-fill');
  speedFill.style.strokeDashoffset = Math.max(0, speedOffset);
  speedFill.style.stroke = speedKmh > 100 ? '#ff1744' : speedKmh > 60 ? '#ff9100' : '#00e676';
  document.getElementById('speed-gauge-val').textContent = speedKmh;

  const batOffset = map(batteryPct, 0, 100, 264, 0);
  const batFill = document.getElementById('gauge-battery-fill');
  batFill.style.strokeDashoffset = Math.max(0, batOffset);
  batFill.style.stroke = batteryPct < 20 ? '#ff1744' : batteryPct < 40 ? '#ff9100' : '#00e5ff';
  document.getElementById('battery-gauge-val').textContent = batteryPct;

  // Viewport HUD speed & battery
  const vpdSpeed = document.getElementById('vpd-speed-val');
  vpdSpeed.textContent = speedKmh;
  vpdSpeed.style.color = speedKmh > 100 ? '#ff1744' : speedKmh > 60 ? '#ff9100' : '#00e676';

  const vpdBat = document.getElementById('vpd-bat-fill');
  vpdBat.style.width = `${batteryPct}%`;
  vpdBat.style.background = batteryPct < 20 ? '#ff1744' : batteryPct < 40 ? '#ff9100' : '#00e5ff';

  // ─── Metrics ──────────────────────────────
  const steerDeg = round(degrees(ev.steerAngle));
  const range = round((ev.battery / 100) * ev.batteryRange);

  setMetric('metric-steering', `${steerDeg}°`);
  setMetric('metric-range', `${range} km`);
  setMetric('metric-waypoint', `${ai.currentWaypoint} / ${ai.waypoints.length}`);
  setMetric('metric-confidence', `${round(ai.confidence * 100)}%`);
  setMetric('metric-frametime', `${round(deltaTime)}ms`);
  setMetric('metric-obstacles', `${ai.detectedObstacles.length} detected`);
  setMetric('metric-ai-mode', ai.state);
  setMetric('metric-decision', ai.decision);
  setMetric('metric-control', 'Pure Pursuit');
  setMetric('metric-steer-out', ai.steerOutput.toFixed(2));
  setMetric('metric-throttle', ai.throttleOutput.toFixed(2));
  setMetric('metric-brake', ai.brakeOutput.toFixed(2));

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
  document.getElementById('sb-coords').textContent =
    `X: ${ev.pos.x.toFixed(1)}  Y: 0.0  Z: ${ev.pos.z.toFixed(1)}`;

  const camNames = ['Chase', 'Top-Down', 'Orbit', 'First-Person'];
  document.getElementById('sb-camera').textContent = `Camera: ${camNames[cameraMode]}`;

  document.getElementById('sb-fps').textContent = `${round(frameRate())} FPS`;

  // ─── AI State Badge ───────────────────────
  const badge = document.getElementById('badge-state');
  if (badge) {
    const dot = badge.querySelector('.state-dot');
    badge.textContent = ai.state;
    badge.prepend(dot);
  }

  // ─── Status Badge (top bar) ────────────────
  const statusEl = document.getElementById('status-indicator');
  const dotEl = statusEl.querySelector('.status-dot');
  if (ai.state.includes('Avoid') || ai.state.includes('Braking')) {
    statusEl.className = 'status-badge status-manual';
    statusEl.innerHTML = '<span class="status-dot"></span> AVOIDING';
  } else if (ai.state.includes('Eco')) {
    statusEl.className = 'status-badge status-manual';
    statusEl.innerHTML = '<span class="status-dot"></span> ECO MODE';
  } else if (ev.battery < 5) {
    statusEl.className = 'status-badge status-danger';
    statusEl.innerHTML = '<span class="status-dot"></span> LOW BATTERY';
  } else {
    statusEl.className = 'status-badge status-autonomous';
    statusEl.innerHTML = '<span class="status-dot"></span> AUTONOMOUS';
  }

  // ─── Status Bar Message ───────────────────
  document.getElementById('sb-message').textContent = ai.decision;
}

function setMetric(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ═══════════════════════════════════════════════════
// UI EVENTS
// ═══════════════════════════════════════════════════

function setupUIEvents() {
  // ─── Action Buttons ───────────────────────
  document.getElementById('btn-toggle').addEventListener('click', () => {
    paused = !paused;
    const btn = document.getElementById('btn-toggle');
    btn.querySelector('span').textContent = paused ? 'Play' : 'Pause';
    btn.querySelector('svg').innerHTML = paused
      ? '<polygon points="5,3 19,12 5,21" fill="currentColor"/>'
      : '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    ev.pos = ai.waypoints[0].copy();
    ev.rotation = 0;
    ev.speed = 0;
    ev.battery = 85;
    ai.currentWaypoint = 0;
    ai.lastDistances = [];
    paused = false;
    const btn = document.getElementById('btn-toggle');
    btn.querySelector('span').textContent = 'Pause';
    btn.querySelector('svg').innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
  });

  document.getElementById('btn-camera').addEventListener('click', () => {
    cameraMode = (cameraMode + 1) % 4;
    const names = ['Chase', 'Top-Down', 'Orbit', 'First-Person'];
    document.getElementById('btn-camera').querySelector('span').textContent = names[cameraMode];
  });

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

  // ─── Toolbar Buttons ─────────────────────
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.getElementById('tool-reset').addEventListener('click', () => {
    cameraMode = 0;
  });

  document.getElementById('tool-grid').addEventListener('click', () => {
    showGrid = !showGrid;
    document.getElementById('tool-grid').classList.toggle('active');
  });

  document.getElementById('tool-screenshot').addEventListener('click', () => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = `ev-ai-screenshot-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  });

  document.getElementById('tool-fullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.body.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  });

  // ─── Keyboard shortcuts ──────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Space') {
      e.preventDefault();
      document.getElementById('btn-toggle').click();
    }
    if (e.key === 'r' || e.key === 'R') {
      document.getElementById('btn-reset').click();
    }
    if (e.key === 'c' || e.key === 'C') {
      document.getElementById('btn-camera').click();
    }
    if (e.key === 'g' || e.key === 'G') {
      document.getElementById('tool-grid').click();
    }
    if (e.key === 'f' || e.key === 'F') {
      document.getElementById('tool-fullscreen').click();
    }
  });
}
