// ════════════════════════════════════════════════
// EV-AI — Autonomous Driving Agent
// Neural-inspired controller with sensor fusion
// ════════════════════════════════════════════════

class AIAgent {
  constructor(ev) {
    this.ev = ev;

    // Waypoint path (road course)
    this.waypoints = this.generateTrack();
    this.currentWaypoint = 0;
    this.lookAhead = 2;  // waypoint index offset

    // Sensor system
    this.sensors = {
      fl: { angle: -0.4, range: 60, distance: Infinity, active: false },
      fm: { angle: 0,    range: 50, distance: Infinity, active: false },
      fr: { angle: 0.4,  range: 60, distance: Infinity, active: false },
      sl: { angle: -PI/2, range: 30, distance: Infinity, active: false },
      sr: { angle:  PI/2, range: 30, distance: Infinity, active: false },
      rl: { angle: -2.7, range: 20, distance: Infinity, active: false },
      rm: { angle: PI,    range: 15, distance: Infinity, active: false },
      rr: { angle: 2.7,   range: 20, distance: Infinity, active: false },
    };

    // State
    this.state = 'following';   // following, avoiding, stopping, reversing
    this.decision = 'accelerate';
    this.confidence = 0.95;
    this.steerOutput = 0;
    this.throttleOutput = 0;
    this.brakeOutput = 0;

    // Memory
    this.lastDistances = [];
    this.historySize = 10;
    this.stuckTimer = 0;

    // Environment obstacles (buildings, trees)
    this.obstacles = this.generateObstacles();
    this.detectedObstacles = [];
  }

  // ─── Generate a racing track as waypoints ────
  generateTrack() {
    const pts = [];
    const radius = 12;
    const segments = 16;

    // Oval track with some variation
    for (let i = 0; i < segments; i++) {
      const t = (i / segments) * TWO_PI;
      const rx = radius + sin(t * 2) * 3;
      const rz = radius * 0.6 + cos(t * 3) * 2;
      pts.push(createVector(rx * cos(t), 0, rx * sin(t) * 0.7 + rz * 0.3));
    }

    // Smooth with interpolation
    const smoothPts = [];
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[(i - 1 + pts.length) % pts.length];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      const p3 = pts[(i + 2) % pts.length];

      for (let t = 0; t < 1; t += 0.25) {
        const x = catmullRom(t, p0.x, p1.x, p2.x, p3.x);
        const z = catmullRom(t, p0.z, p1.z, p2.z, p3.z);
        smoothPts.push(createVector(x, 0, z));
      }
    }
    return smoothPts;
  }

  // ─── Generate environmental obstacles ────────
  generateObstacles() {
    const obs = [];
    const positions = [
      [-5, -3], [8, 2], [-10, 6], [15, -4],
      [-3, -9], [12, 8], [-14, -5], [6, -7],
      [0, 12], [-8, 10], [18, 0], [-18, -2],
    ];
    for (const [x, z] of positions) {
      obs.push({
        pos: createVector(x, 0, z),
        radius: 1.0 + random(0.5),
        height: 1.5 + random(2),
        type: random(['building', 'tree', 'cone']),
      });
    }
    return obs;
  }

  // ─── Catmull-Rom interpolation ───────────────
  catmullRom(t, p0, p1, p2, p3) {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * (
      (2 * p1) +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    );
  }

  // ─── Sensor raycasting against obstacles ────
  updateSensors() {
    const ev = this.ev;
    this.detectedObstacles = [];

    for (const [key, sensor] of Object.entries(this.sensors)) {
      const angle = ev.rotation + sensor.angle;
      const origin = ev.getSensorPosition([0, 0, 0.3]);
      let minDist = sensor.range;
      let hit = false;

      // Cast ray and check against obstacles
      for (const obs of this.obstacles) {
        // Simplified: circle vs ray intersection
        const dx = obs.pos.x - origin.x;
        const dz = obs.pos.z - origin.z;
        const dist = sqrt(dx*dx + dz*dz);
        const angleToObs = atan2(dz, dx);
        const angleDiff = angleDiffNormalized(angleToObs, angle);

        if (abs(angleDiff) < 0.4 && dist < sensor.range + obs.radius) {
          // Within sensor cone
          if (dist < minDist) {
            minDist = dist;
            hit = true;
            this.detectedObstacles.push({
              key, dist, angleDiff,
              type: obs.type,
              pos: obs.pos
            });
          }
        }
      }

      sensor.distance = minDist;
      sensor.active = hit && minDist < sensor.range * 0.7;
    }
  }

  // ─── Decision making ──────────────────────────
  decide(dt) {
    const ev = this.ev;
    const sensors = this.sensors;

    // Get target waypoint
    const target = this.waypoints[this.currentWaypoint % this.waypoints.length];
    const nextTarget = this.waypoints[(this.currentWaypoint + this.lookAhead) % this.waypoints.length];

    // Vector to waypoint
    const dx = target.x - ev.pos.x;
    const dz = target.z - ev.pos.z;
    const distToWaypoint = sqrt(dx*dx + dz*dz);

    // Angle to waypoint (relative to car heading)
    const targetAngle = atan2(dz, dx);
    const angleError = angleDiffNormalized(targetAngle, ev.rotation);

    // Look-ahead steering
    const nDx = nextTarget.x - ev.pos.x;
    const nDz = nextTarget.z - ev.pos.z;
    const lookAngle = atan2(nDz, nDx);
    const lookError = angleDiffNormalized(lookAngle, ev.rotation);

    // ─── Obstacle avoidance ──────────────────
    const frontClear = sensors.fm.distance > sensors.fm.range * 0.3;
    const leftClear = sensors.fl.distance > sensors.fl.range * 0.4;
    const rightClear = sensors.fr.distance > sensors.fr.range * 0.4;
    const sideLeftClear = sensors.sl.distance > sensors.sl.range * 0.5;
    const sideRightClear = sensors.sr.distance > sensors.sr.range * 0.5;

    // ─── State machine ───────────────────────
    let steer = 0;
    let throttle = 0;
    let brake = 0;
    let decisionText = 'Following path';
    let stateText = 'Path Following';
    let confidence = 0.92;

    if (distToWaypoint < 3) {
      // Reached waypoint, advance
      this.currentWaypoint = (this.currentWaypoint + 1) % this.waypoints.length;
    }

    if (!frontClear && ev.speed > 2) {
      // Obstacle ahead — avoid
      stateText = 'Obstacle Avoidance';
      this.state = 'avoiding';

      if (leftClear) {
        steer = -0.5;
        throttle = 0.3;
        decisionText = 'Steering left around obstacle';
      } else if (rightClear) {
        steer = 0.5;
        throttle = 0.3;
        decisionText = 'Steering right around obstacle';
      } else {
        brake = 0.8;
        throttle = 0;
        decisionText = 'Emergency braking';
        confidence = 0.6;
      }
    } else if (ev.speed < 0.5 && distToWaypoint > 8) {
      // Stuck — reverse and turn
      stateText = 'Recovery';
      this.state = 'reversing';
      steer = sin(frameCount * 0.02) * 0.6;
      throttle = -0.4;
      decisionText = 'Stuck — reversing';
      confidence = 0.5;
    } else {
      // Normal path following
      stateText = 'Path Following';
      this.state = 'following';

      // Pure pursuit steering
      const pursuitGain = 2.0;
      steer = constrain(lookError * pursuitGain, -0.5, 0.5);

      // Speed control based on upcoming curvature
      const curvature = abs(lookError);
      const targetSpeed = map(curvature, 0, 0.8, 25, 8);
      const speedError = targetSpeed - ev.speed;

      if (speedError > 0) {
        throttle = constrain(speedError * 0.05, 0, 1);
        decisionText = `Accelerating to ${round(targetSpeed)} m/s`;
      } else if (speedError < -1) {
        brake = constrain(-speedError * 0.03, 0, 0.5);
        decisionText = `Braking for ${round(curvature*100)}% curve`;
      } else {
        throttle = 0.1;  // coast
        decisionText = 'Coasting at speed';
      }
    }

    // Battery management
    if (ev.battery < 15) {
      throttle = min(throttle, 0.3);
      decisionText = '⚡ Eco mode — conserving battery';
      stateText = 'Eco Mode';
    }

    // Compute confidence
    confidence = constrain(confidence - (brake > 0.5 ? 0.2 : 0) + (frontClear ? 0.01 : -0.01), 0, 1);

    // Store outputs
    this.steerOutput = steer;
    this.throttleOutput = throttle;
    this.brakeOutput = brake;
    this.decision = decisionText;
    this.state = stateText;
    this.confidence = confidence;

    // Track for stuck detection
    this.lastDistances.push(distToWaypoint);
    if (this.lastDistances.length > this.historySize) this.lastDistances.shift();
  }

  // ─── Apply decisions to EV ───────────────────
  apply(dt) {
    this.ev.update(dt, this.steerOutput, this.throttleOutput, this.brakeOutput);
  }

  // ─── Update sensors + decide + apply ─────────
  tick(dt) {
    this.updateSensors();
    this.decide(dt);
    this.apply(dt);
  }

  // ─── Render debug visualization ──────────────
  renderDebug() {
    const ev = this.ev;

    // Draw waypoint path
    push();
    noFill();
    stroke(0, 229, 255, 40);
    strokeWeight(1);
    beginShape();
    for (const wp of this.waypoints) {
      vertex(wp.x, 0.02, wp.z);
    }
    endShape(CLOSE);
    pop();

    // Draw current waypoint target
    const target = this.waypoints[this.currentWaypoint % this.waypoints.length];
    push();
    translate(target.x, 0.5, target.z);
    fill(0, 229, 255);
    noStroke();
    sphere(0.3);
    pop();

    // Draw sensor rays
    push();
    const origin = ev.getSensorPosition([0, 0, 0.3]);
    for (const [key, sensor] of Object.entries(this.sensors)) {
      const angle = ev.rotation + sensor.angle;
      const dist = sensor.active ? min(sensor.distance, sensor.range) : sensor.range;
      const endX = origin.x + cos(angle) * dist;
      const endZ = origin.z + sin(angle) * dist;

      if (sensor.active) {
        stroke(255, 50, 50, 150);
        strokeWeight(2);
      } else {
        stroke(0, 229, 255, 50);
        strokeWeight(1);
      }
      line(origin.x, 0.05, origin.z, endX, 0.05, endZ);
    }
    pop();

    // Draw obstacles
    for (const obs of this.obstacles) {
      push();
      translate(obs.pos.x, 0, obs.pos.z);

      if (obs.type === 'building') {
        fill(60, 60, 80, 180);
        stroke(80, 80, 100);
        strokeWeight(1);
        box(obs.radius * 1.5, obs.height, obs.radius * 1.5);
      } else if (obs.type === 'tree') {
        fill(30, 80, 40, 200);
        noStroke();
        cylinder(obs.radius * 0.5, obs.height * 0.3);  // trunk
        translate(0, obs.height * 0.15, 0);
        fill(40, 120, 50, 200);
        sphere(obs.radius * 0.6);  // canopy
      } else {
        fill(200, 120, 0, 180);
        noStroke();
        cone(obs.radius * 0.4, obs.height * 0.5);
      }
      pop();
    }
  }
}

// ─── Utility: normalized angle difference ───────
function angleDiffNormalized(a, b) {
  let diff = a - b;
  while (diff > PI) diff -= TWO_PI;
  while (diff < -PI) diff += TWO_PI;
  return diff;
}
