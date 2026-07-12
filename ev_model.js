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

    // Start loading 3D model
    this.loadModel();
  }

  async loadModel() {
    // Try loading the local OBJ file directly
    const objUrl = 'ev_model.obj';
    console.log(`[EV-AI] Loading 3D model: ${objUrl}`);

    try {
      this.loadedModel = await new Promise((resolve, reject) => {
        const model = loadModel(
          objUrl,
          () => resolve(model),
          () => reject(new Error('loadModel callback failed'))
        );
        setTimeout(() => reject(new Error('loadModel timeout')), 8000);
      });
      this.modelReady = true;
      console.log('[EV-AI] 3D model loaded successfully');
    } catch (e) {
      console.log('[EV-AI] OBJ load failed, using procedural model:', e.message);
      this.useProcedural = true;
    }
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

  // ─── Physics Update ─────────────────────────
  update(dt, steerInput, throttleInput, brakeInput) {
    const maxSpeed = 25;
    const maxSteer = 0.6;
    const accelRate = 12;
    const brakeRate = 20;
    const friction = 2.5;
    const steerSpeed = 3.0;

    // Steering — smooth interpolation toward target
    const targetSteer = steerInput * maxSteer;
    this.steerAngle += (targetSteer - this.steerAngle) * constrain(steerInput === 0 ? 5 : steerSpeed, 0, 8) * dt;
    if (abs(this.steerAngle) < 0.001) this.steerAngle = 0;

    // Throttle
    if (throttleInput > 0) {
      this.speed += throttleInput * accelRate * dt;
    } else if (throttleInput < 0) {
      // Reverse
      this.speed += throttleInput * accelRate * 0.5 * dt;
    }

    // Brake
    if (brakeInput > 0) {
      if (this.speed > 0) {
        this.speed = max(0, this.speed - brakeInput * brakeRate * dt);
      } else {
        this.speed = min(0, this.speed + brakeInput * brakeRate * dt);
      }
    }

    // Friction / drag
    if (throttleInput === 0 && brakeInput === 0) {
      if (this.speed > 0) {
        this.speed = max(0, this.speed - friction * dt);
      } else if (this.speed < 0) {
        this.speed = min(0, this.speed + friction * dt);
      }
    }

    // Clamp speed
    this.speed = constrain(this.speed, -maxSpeed * 0.3, maxSpeed);

    // Steering effect on rotation — proportional to speed
    const speedFactor = constrain(abs(this.speed) / 8, 0, 1);
    this.rotation += this.steerAngle * speedFactor * dt * 2.0;

    // Update position
    this.pos.x += cos(this.rotation) * this.speed * dt;
    this.pos.z += sin(this.rotation) * this.speed * dt;

    // Battery drain — faster at higher speeds
    const drain = (abs(this.speed) * 0.01 + 0.02) * dt;
    this.battery = max(0, this.battery - drain);

    // Brake light state
    this.brakeActive = brakeInput > 0.1;
  }

  // ─── Physics helpers ────────────────────────
  getForward() {
    return createVector(cos(this.rotation), 0, sin(this.rotation));
  }

  getPosition3D() {
    return createVector(this.pos.x, this.groundClearance + this.height * 0.3, this.pos.z);
  }

  getSensorPosition(offset) {
    const cos_r = cos(this.rotation);
    const sin_r = sin(this.rotation);
    const x = this.pos.x + offset[0] * cos_r - offset[2] * sin_r;
    const z = this.pos.z + offset[0] * sin_r + offset[2] * cos_r;
    const y = this.groundClearance + this.height * 0.5 + (offset[1] || 0);
    return createVector(x, y, z);
  }
}
