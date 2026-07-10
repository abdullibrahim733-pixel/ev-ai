// ═══════════════════════════════════════════════════════
// EV-AI — 3D Electric Vehicle Model
// Loads from Python backend (GLTF/OBJ) with procedural fallback
// ═══════════════════════════════════════════════════════

class EVModel {
  constructor() {
    // ─── Physical dimensions ────────────────
    this.length = 4.2;
    this.width = 1.8;
    this.height = 1.4;
    this.wheelRadius = 0.32;
    this.wheelWidth = 0.18;
    this.groundClearance = 0.15;

    // ─── State ──────────────────────────────
    this.pos = createVector(0, 0, 0);
    this.rotation = 0;
    this.speed = 0;
    this.battery = 85;
    this.batteryRange = 380;  // km at full charge
    this.steerAngle = 0;
    this.brakeActive = false;
    this.lightOn = true;

    // ─── 3D Model ───────────────────────────
    this.loadedModel = null;
    this.modelReady = false;
    this.useProcedural = false;  // fallback to primitives
    this.loadStartTime = millis();

    // Start loading from backend
    this.loadFromBackend();
  }

  async loadFromBackend() {
    // Try to load the 3D model from the Python backend
    const backends = [
      window.location.origin + '/api/model?format=obj',
      'http://localhost:8000/api/model?format=obj',
      'http://127.0.0.1:8000/api/model?format=obj',
    ];

    for (const url of backends) {
      try {
        const resp = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(2000) });
        if (resp.ok) {
          console.log(`[EV-AI] Loading 3D model from: ${url}`);
          this.loadedModel = await new Promise((resolve, reject) => {
            const model = loadModel(
              url,
              () => resolve(model),
              () => reject(new Error('loadModel failed'))
            );
            // Safety timeout
            setTimeout(() => reject(new Error('loadModel timeout')), 5000);
          });
          this.modelReady = true;
          console.log('[EV-AI] 3D model loaded successfully');
          return;
        }
      } catch (e) {
        console.log(`[EV-AI] Backend at ${url} not available`);
      }
    }

    // Fallback: try loading static OBJ from GitHub Pages
    try {
      const staticUrl = window.location.origin + '/ev_model.obj';
      console.log(`[EV-AI] Trying static model: ${staticUrl}`);
      this.loadedModel = await new Promise((resolve, reject) => {
        const model = loadModel(
          staticUrl,
          () => resolve(model),
          () => reject(new Error('static model failed'))
        );
        setTimeout(() => reject(new Error('static model timeout')), 5000);
      });
      this.modelReady = true;
      console.log('[EV-AI] Static model loaded');
      return;
    } catch (e) {
      console.log('[EV-AI] Static model not available');
    }

    // Ultimate fallback: procedural rendering
    console.log('[EV-AI] Using procedural model');
    this.useProcedural = true;
  }

  // ─── Render ─────────────────────────────────
  render() {
    if (this.modelReady && this.loadedModel) {
      this.renderLoadedModel();
    } else {
      this.renderProcedural();
    }
    this.renderDebugOverlay();
  }

  renderLoadedModel() {
    push();
    translate(this.pos.x, 0, this.pos.z);
    rotateY(this.rotation);

    // Scale the model to match our units
    const s = 0.6;
    scale(s);

    // Apply materials
    fill(30, 160, 240);
    specularMaterial(30, 160, 240);
    shininess(80);

    // Render the loaded model
    if (this.loadedModel) {
      model(this.loadedModel);
    }

    pop();
  }

  renderProcedural() {
    push();
    translate(this.pos.x, 0, this.pos.z);
    rotateY(this.rotation);

    const len = this.length;
    const wid = this.width;
    const hgt = this.height;
    const wr = this.wheelRadius;
    const ww = this.wheelWidth;
    const gc = this.groundClearance;
    const cy = gc + hgt * 0.5;

    // ─── Body (lower) ─────────────────────
    push();
    fill(30, 160, 240);
    specularMaterial(30, 160, 240);
    shininess(60);
    translate(0, cy, 0);
    box(len * 0.9, hgt * 0.55, wid * 0.92);
    pop();

    // ─── Cabin (upper) ────────────────────
    push();
    fill(40, 170, 250, 220);
    specularMaterial(40, 170, 250);
    shininess(40);
    translate(0, cy + hgt * 0.45, 0);
    box(len * 0.55, hgt * 0.35, wid * 0.85);
    pop();

    // ─── Windshield (glass) ───────────────
    push();
    fill(100, 200, 255, 60);
    specularMaterial(150, 200, 255);
    shininess(100);
    translate(len * 0.07, cy + hgt * 0.45, 0);
    box(len * 0.3, hgt * 0.3, wid * 0.8);
    pop();

    // ─── Front Bumper ─────────────────────
    push();
    fill(20, 20, 30);
    translate(len * 0.42, cy - 0.05, 0);
    box(len * 0.08, hgt * 0.35, wid * 0.88);
    pop();

    // ─── Rear Bumper ──────────────────────
    push();
    fill(20, 20, 30);
    translate(-len * 0.42, cy - 0.05, 0);
    box(len * 0.08, hgt * 0.35, wid * 0.88);
    pop();

    // ─── Headlights ───────────────────────
    push();
    if (this.lightOn) {
      emissiveMaterial(200, 200, 100);
      fill(200, 200, 100);
    } else {
      fill(100, 100, 100);
    }
    translate(len * 0.44, cy, wid * 0.3);
    box(0.04, 0.08, 0.25);
    translate(0, 0, -wid * 0.6);
    box(0.04, 0.08, 0.25);
    pop();
    noEmissiveMaterial();

    // ─── Tail Lights ──────────────────────
    push();
    if (this.brakeActive) {
      emissiveMaterial(255, 0, 0);
      fill(255, 0, 0);
    } else {
      fill(100, 20, 20);
    }
    translate(-len * 0.44, cy, wid * 0.3);
    box(0.04, 0.08, 0.22);
    translate(0, 0, -wid * 0.6);
    box(0.04, 0.08, 0.22);
    pop();
    noEmissiveMaterial();

    // ─── Wheels ────────────────────────────
    const wPositions = [
      [len * 0.3, gc + wr, wid * 0.52],
      [len * 0.3, gc + wr, -wid * 0.52],
      [-len * 0.28, gc + wr, wid * 0.52],
      [-len * 0.28, gc + wr, -wid * 0.52],
    ];
    for (let i = 0; i < 4; i++) {
      const [wx, wy, wz] = wPositions[i];
      const isFront = i < 2;
      push();
      translate(wx, wy, wz);
      if (isFront) rotateY(this.steerAngle);
      rotateX(this.speed * 4.5);
      fill(20, 20, 25);
      cylinder(wr, ww);
      pop();

      // Rim
      push();
      translate(wx, wy, wz);
      if (isFront) rotateY(this.steerAngle);
      rotateX(this.speed * 4.5);
      fill(60, 60, 70);
      specularMaterial(60, 60, 70);
      translate(0, 0, ww * 0.6);
      cylinder(wr * 0.4, 0.02);
      pop();
    }

    // ─── Side Mirrors ──────────────────────
    push();
    fill(30, 30, 40);
    translate(len * 0.25, cy + 0.1, wid * 0.52);
    box(0.12, 0.06, 0.04);
    translate(0, 0, -wid * 1.04);
    box(0.12, 0.06, 0.04);
    pop();

    pop(); // main transform
  }

  renderDebugOverlay() {
    // Loading indicator
    if (!this.modelReady && !this.useProcedural) {
      const elapsed = (millis() - this.loadStartTime) / 1000;
      push();
      fill(255);
      translate(0, 2, 0);
      textAlign(CENTER);
      textSize(0.3);
      fill(0, 229, 255);
      text(`Loading 3D model... ${elapsed.toFixed(0)}s`, 0, 0);
      pop();
    }
  }

  // ─── Physics helpers ────────────────────────
  getForward() {
    return createVector(cos(this.rotation), 0, sin(this.rotation));
  }

  getPosition3D() {
    return createVector(this.pos.x, this.groundClearance + this.height * 0.3, this.pos.z);
  }
}
