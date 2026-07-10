// ════════════════════════════════════════════════
// EV-AI — 3D Electric Vehicle Model
// Constructed from p5.js WEBGL primitives
// ════════════════════════════════════════════════

class EVModel {
  constructor() {
    // Physical dimensions (units)
    this.length = 4.2;
    this.width = 1.8;
    this.height = 1.4;
    this.wheelRadius = 0.32;
    this.wheelWidth = 0.22;

    // Dynamic state
    this.pos = createVector(0, 0, 0);
    this.rotation = 0;           // heading angle (radians)
    this.steerAngle = 0;         // front wheels steering
    this.speed = 0;              // m/s
    this.acceleration = 0;
    this.battery = 85;           // percentage
    this.batteryRange = 320;     // km at full charge

    // Visual
    this.bodyColor = [30, 180, 255];  // Electric blue
    this.accentColor = [0, 229, 255]; // Cyan accent
    this.glassColor = [100, 200, 255, 80];
    this.wheelColor = [30, 30, 40];
    this.lightOn = false;
    this.brakeActive = false;

    // Suspension bob
    this.bobPhase = 0;
  }

  // ─── Update physics ─────────────────────────
  update(dt, steerInput, throttle, brake) {
    // Steering response (smooth)
    const targetSteer = constrain(steerInput, -0.6, 0.6);
    this.steerAngle = lerp(this.steerAngle, targetSteer, 5 * dt);

    // Acceleration / braking
    if (throttle > 0 && this.battery > 0) {
      const power = throttle * 1.2;  // 0-1.2 m/s²
      this.acceleration = power;
      this.battery -= power * dt * 0.02;  // battery drain
    } else if (brake > 0) {
      this.acceleration = -brake * 0.8;
      this.brakeActive = brake > 0.3;
    } else {
      // Rolling resistance
      this.acceleration = -this.speed * 0.02;
      this.brakeActive = false;
    }

    // Update speed
    this.speed += this.acceleration * dt;
    this.speed = constrain(this.speed, 0, 35);  // max ~126 km/h

    // Update heading (Ackermann-like steering)
    const turnRate = this.speed * this.steerAngle * 0.3;
    this.rotation += turnRate * dt;

    // Update position
    this.pos.x += cos(this.rotation) * this.speed * dt;
    this.pos.z += sin(this.rotation) * this.speed * dt;

    // Suspension bob
    this.bobPhase += this.speed * dt * 3;
  }

  // ─── Render the 3D model ────────────────────
  render() {
    push();
    translate(this.pos.x, 0, this.pos.z);
    rotateY(this.rotation);

    // Suspension bob offset
    const bobY = sin(this.bobPhase) * 0.02 * (this.speed / 10);

    // ─── Main Body ────────────────────────────
    push();
    translate(0, this.height * 0.35 + bobY, 0);

    // Lower body
    fill(this.bodyColor[0], this.bodyColor[1], this.bodyColor[2]);
    specularMaterial(this.bodyColor[0], this.bodyColor[1], this.bodyColor[2]);
    shininess(80);
    noStroke();
    box(this.length * 0.95, this.height * 0.5, this.width * 0.95);

    // Upper body / cabin
    push();
    translate(0, this.height * 0.35, -0.1);
    fill(this.bodyColor[0], this.bodyColor[1], this.bodyColor[2]);
    specularMaterial(this.bodyColor[0]+20, this.bodyColor[1]+20, this.bodyColor[2]+20);
    shininess(60);
    box(this.length * 0.55, this.height * 0.35, this.width * 0.85);
    pop();

    // ─── Windshield (glass) ────────────────────
    push();
    translate(-0.3, this.height * 0.35, 0);
    fill(this.glassColor[0], this.glassColor[1], this.glassColor[2], this.glassColor[3]);
    specularMaterial(150, 200, 255);
    shininess(120);
    // Slightly tilted windshield
    rotateX(0.15);
    box(this.length * 0.3, this.height * 0.3, this.width * 0.8);
    pop();

    // Rear window
    push();
    translate(0.35, this.height * 0.35, 0);
    fill(this.glassColor[0], this.glassColor[1], this.glassColor[2], this.glassColor[3]);
    specularMaterial(150, 200, 255);
    shininess(120);
    rotateX(-0.1);
    box(this.length * 0.25, this.height * 0.28, this.width * 0.8);
    pop();

    // ─── Front bumper / grille ─────────────────
    push();
    translate(-this.length * 0.47, -0.05, 0);
    fill(20, 20, 30);
    noSpecular();
    box(0.1, 0.25, this.width * 0.6);
    pop();

    // Grille accent
    push();
    translate(-this.length * 0.47, 0.08, 0);
    fill(this.accentColor[0], this.accentColor[1], this.accentColor[2]);
    emissiveMaterial(this.accentColor[0]*0.5, this.accentColor[1]*0.5, this.accentColor[2]*0.5);
    box(0.06, 0.06, this.width * 0.35);
    pop();

    // ─── Headlights ────────────────────────────
    push();
    translate(-this.length * 0.48, 0.0, -0.45);
    fill(255, 255, 200);
    if (this.lightOn) emissiveMaterial(200, 200, 100);
    else noEmissiveMaterial();
    sphere(0.08);
    pop();

    push();
    translate(-this.length * 0.48, 0.0, 0.45);
    fill(255, 255, 200);
    if (this.lightOn) emissiveMaterial(200, 200, 100);
    else noEmissiveMaterial();
    sphere(0.08);
    pop();

    // ─── Taillights ────────────────────────────
    push();
    translate(this.length * 0.48, 0.05, -0.45);
    if (this.brakeActive) { fill(255, 0, 0); emissiveMaterial(255, 0, 0); }
    else { fill(100, 0, 0); noEmissiveMaterial(); }
    sphere(0.07);
    pop();

    push();
    translate(this.length * 0.48, 0.05, 0.45);
    if (this.brakeActive) { fill(255, 0, 0); emissiveMaterial(255, 0, 0); }
    else { fill(100, 0, 0); noEmissiveMaterial(); }
    sphere(0.07);
    pop();

    // ─── Roof fin / antenna ────────────────────
    push();
    translate(0.1, this.height * 0.72, 0);
    fill(50, 50, 60);
    cylinder(0.03, 0.2);
    pop();

    pop(); // end body group

    // ─── Wheels ────────────────────────────────
    const wPositions = [
      [-1.2, -1.1],  // Front-Left
      [-1.2,  1.1],  // Front-Right
      [ 1.2, -1.1],  // Rear-Left
      [ 1.2,  1.1],  // Rear-Right
    ];

    for (let i = 0; i < wPositions.length; i++) {
      const [wx, wz] = wPositions[i];
      const isFront = i < 2;
      const steer = isFront ? this.steerAngle : 0;

      push();
      translate(wx, this.wheelRadius + 0.05 + bobY, wz);

      // Steering on front wheels
      if (isFront) rotateY(steer);

      // Wheel rotation from speed
      rotateX(this.speed * 4.5);

      // Tire
      fill(this.wheelColor[0], this.wheelColor[1], this.wheelColor[2]);
      noSpecular();
      cylinder(this.wheelRadius, this.wheelWidth);

      // Rim
      push();
      translate(0, 0, this.wheelWidth * 0.52);
      fill(180, 180, 190);
      specularMaterial(200, 200, 210);
      shininess(40);
      cylinder(this.wheelRadius * 0.5, 0.03);
      pop();

      // Rim spokes (5-spoke)
      for (let s = 0; s < 5; s++) {
        const angle = (s / 5) * TWO_PI + this.speed * 2;
        push();
        translate(0, 0, this.wheelWidth * 0.52);
        rotateZ(angle);
        translate(this.wheelRadius * 0.3, 0, 0);
        fill(180, 180, 190);
        box(0.04, 0.04, 0.02);
        pop();
      }

      pop();
    }

    // ─── Under-glow (EV accent) ────────────────
    if (this.speed > 1) {
      push();
      translate(0, -0.05, 0);
      fill(this.accentColor[0], this.accentColor[1], this.accentColor[2], 30);
      noStroke();
      box(this.length * 0.7, 0.01, this.width * 0.6);
      pop();
    }

    pop(); // end main transform
  }

  // ─── Get sensor position for raycasting ─────
  getSensorPosition(offset) {
    // offset is [forward, right, up] relative to car
    const fwd = offset[0];
    const rgt = offset[1];
    const up = offset[2];
    const cosR = cos(this.rotation);
    const sinR = sin(this.rotation);
    return createVector(
      this.pos.x + fwd * cosR - rgt * sinR,
      this.height * 0.3 + up,
      this.pos.z + fwd * sinR + rgt * cosR
    );
  }
}
