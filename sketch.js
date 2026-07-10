// ════════════════════════════════════════════════
// EV-AI — Main Sketch
// p5.js WEBGL 3D renderer + dashboard bridge
// ════════════════════════════════════════════════

let ev, ai;
let paused = false;
let cameraMode = 0;  // 0=chase, 1=top, 2=orbit, 3=first-person
let camAngle = 0;
let orbitAngle = 0;

// Road rendering
let roadTexture;
let groundLines = [];
const NUM_BUILDINGS = 18;

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

  // Generate ground markings
  for (let i = 0; i < 80; i++) {
    groundLines.push({
      x: random(-25, 25),
      z: random(-25, 25),
      w: random(0.5, 2),
      h: random(0.05, 0.15),
      color: [random(255), random(255), random(255), 10],
    });
  }

  setCamera();
  setupUI();
}

// ─── Draw Loop ─────────────────────────────────
function draw() {
  const dt = min(deltaTime / 1000, 0.05);  // cap dt

  // Update
  if (!paused) {
    ai.tick(dt);
  }

  // ─── Render Scene ──────────────────────────
  background(8, 8, 25);
  ambientLight(60, 60, 100);
  directionalLight(180, 180, 220, 0.5, -0.8, -0.3);
  ambientMaterial(100, 100, 140);

  setCamera();

  // Ground
  push();
  noStroke();
  fill(12, 12, 35);
  translate(0, -0.05, 0);
  box(60, 0.1, 60);
  pop();

  // Ground grid (road markings)
  push();
  stroke(0, 229, 255, 15);
  strokeWeight(0.05);
  noFill();
  const gridSize = 30;
  for (let i = -gridSize; i <= gridSize; i += 3) {
    line(i, 0.01, -gridSize, i, 0.01, gridSize);
    line(-gridSize, 0.01, i, gridSize, 0.01, i);
  }
  pop();

  // Road circle / track marking
  push();
  noFill();
  stroke(0, 229, 255, 25);
  strokeWeight(0.08);
  const trackRadius = 12;
  for (let r = 0.8; r < 1.2; r += 0.05) {
    ellipse(0, 0, trackRadius * 2 * r, trackRadius * 1.4 * r);
  }
  pop();

  // AI debug visualization
  ai.renderDebug();

  // Render EV
  ev.render();

  // Update HUD
  updateDashboard();
  updateSensors();

  // FPS counter
  document.getElementById('hud-fps').textContent = `${round(frameRate())} FPS`;
}

// ─── Camera Controller ─────────────────────────
function setCamera() {
  const target = ev ? ev.pos : createVector(0, 0, 0);
  const rot = ev ? ev.rotation : 0;

  switch (cameraMode) {
    case 0: // Chase camera
      const chaseDist = 8;
      const chaseHeight = 4;
      const chaseX = target.x - cos(rot) * chaseDist;
      const chaseZ = target.z - sin(rot) * chaseDist;
      camera(chaseX, chaseHeight, chaseZ, target.x, 0.5, target.z, 0, 1, 0);
      break;

    case 1: // Top-down
      camera(target.x, 20, target.z + 0.1, target.x, 0, target.z, 0, 0, -1);
      break;

    case 2: // Orbit
      orbitAngle += 0.005;
      const orbDist = 15;
      const orbX = target.x + cos(orbitAngle) * orbDist;
      const orbZ = target.z + sin(orbitAngle) * orbDist;
      camera(orbX, 8, orbZ, target.x, 0.5, target.z, 0, 1, 0);
      break;

    case 3: // First-person
      const fpX = target.x + cos(rot) * 1.5;
      const fpZ = target.z + sin(rot) * 1.5;
      const fpY = ev ? ev.height * 0.5 : 1;
      camera(fpX, fpY, fpZ,
             target.x + cos(rot) * 5,
             fpY - 0.2,
             target.z + sin(rot) * 5,
             0, 1, 0);
      break;
  }
}

// ─── Window resize ─────────────────────────────
function windowResized() {
  const container = document.getElementById('p5-canvas-wrapper');
  const cw = container.offsetWidth || windowWidth;
  const ch = container.offsetHeight || 500;
  resizeCanvas(cw, ch);
}

// ─── Dashboard Update ──────────────────────────
function updateDashboard() {
  if (!ev) return;

  const speedKmh = round(ev.speed * 3.6);
  const batteryPct = round(constrain(ev.battery, 0, 100));
  const steerDeg = round(degrees(ev.steerAngle));
  const range = round((ev.battery / 100) * ev.batteryRange);

  document.getElementById('dash-speed').textContent = speedKmh;
  document.getElementById('dash-battery').textContent = batteryPct;
  document.getElementById('dash-steering').textContent = `${steerDeg}°`;
  document.getElementById('dash-range').textContent = range;

  // Battery bar
  const fill = document.getElementById('battery-fill');
  fill.style.width = `${batteryPct}%`;
  if (batteryPct < 20) fill.style.background = '#ff1744';
  else if (batteryPct < 40) fill.style.background = '#ff9100';
  else fill.style.background = '#00e5ff';

  // Speed color
  const speedEl = document.getElementById('dash-speed');
  if (speedKmh > 100) speedEl.style.color = '#ff1744';
  else if (speedKmh > 60) speedEl.style.color = '#ff9100';
  else speedEl.style.color = '#00e676';

  // AI panel
  document.getElementById('ai-mode').textContent = ai.state;
  document.getElementById('ai-decision').textContent = ai.decision;
  document.getElementById('ai-confidence').textContent = `${round(ai.confidence * 100)}%`;
  document.getElementById('ai-obstacles').textContent = `${ai.detectedObstacles.length} detected`;
  document.getElementById('ai-waypoint').textContent = `${ai.currentWaypoint} / ${ai.waypoints.length}`;

  // HUD status
  const statusEl = document.getElementById('hud-status');
  if (ai.state.includes('Avoid') || ai.state.includes('Braking')) {
    statusEl.textContent = '⚠️ AVOIDING';
    statusEl.className = 'status-manual';
  } else if (ai.state === 'Eco Mode') {
    statusEl.textContent = '⚡ ECO MODE';
    statusEl.className = 'status-manual';
  } else if (ev.battery < 5) {
    statusEl.textContent = '🔴 LOW BATTERY';
    statusEl.className = 'status-manual';
  } else {
    statusEl.textContent = '● AUTONOMOUS';
    statusEl.className = 'status-autonomous';
  }
}

// ─── Sensor Display ────────────────────────────
function updateSensors() {
  const sensorMap = {
    'sensor-fl': 'fl', 'sensor-fm': 'fm', 'sensor-fr': 'fr',
    'sensor-sl': 'sl', 'sensor-sr': 'sr',
    'sensor-rl': 'rl', 'sensor-rm': 'rm', 'sensor-rr': 'rr',
  };

  for (const [elId, key] of Object.entries(sensorMap)) {
    const el = document.getElementById(elId);
    if (!el) continue;
    const s = ai.sensors[key];
    el.className = 'sensor-dot';
    if (s.active && s.distance < s.range * 0.3) el.classList.add('danger');
    else if (s.active) el.classList.add('warning');
    else if (s.distance < s.range * 0.5) el.classList.add('active');
  }
}

// ─── UI Events ─────────────────────────────────
function setupUI() {
  document.getElementById('reset-btn').addEventListener('click', () => {
    ev.pos = ai.waypoints[0].copy();
    ev.rotation = 0;
    ev.speed = 0;
    ev.battery = 85;
    ai.currentWaypoint = 0;
    ai.lastDistances = [];
    paused = false;
    document.getElementById('toggle-btn').textContent = '⏸ Pause';
  });

  document.getElementById('toggle-btn').addEventListener('click', () => {
    paused = !paused;
    document.getElementById('toggle-btn').textContent = paused ? '▶ Play' : '⏸ Pause';
  });

  document.getElementById('camera-btn').addEventListener('click', () => {
    cameraMode = (cameraMode + 1) % 4;
    const names = ['Chase', 'Top-Down', 'Orbit', 'First-Person'];
    document.getElementById('camera-btn').textContent = `🎥 ${names[cameraMode]}`;
  });
}
