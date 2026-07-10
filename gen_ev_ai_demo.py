#!/usr/bin/env python3
"""EV-AI — Terminal-style coding demo video.
Shows the EV-AI project being built: 3D EV model + AI driving agent.
Usage: python3 gen_ev_ai_demo.py
Produces: ./ev_ai_coding_demo.mp4 (does NOT touch swarmmind video)
"""
import os, sys, subprocess, time
from PIL import Image, ImageDraw, ImageFont

W, H = 960, 540
FPS = 12
FONT_SIZE = 16
LINE_H = 24
MARGIN = (30, 45)

BG = (10, 10, 26)
GREEN = (0, 230, 118)
GRAY = (100, 100, 100)
WHITE = (200, 200, 200)
CYAN = (80, 200, 255)
YELLOW = (255, 200, 80)
HEADER_BG = (20, 20, 40)
CURSOR = (255, 255, 255)

FONT_PATH = None
for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
          "/usr/share/fonts/truetype/ubuntu/UbuntuMono-R.ttf",
          "/usr/share/fonts/truetype/hack/Hack-Regular.ttf",
          "/usr/share/fonts/truetype/freefont/FreeMono.ttf"]:
    if os.path.exists(p): FONT_PATH = p; break
font = ImageFont.truetype(FONT_PATH, FONT_SIZE) if FONT_PATH else ImageFont.load_default()


def make_frame(draw, lines, cursor_pos, scene_title, cursor_visible):
    draw.rectangle([(0, 0), (W, 35)], fill=HEADER_BG)
    draw.text((MARGIN[0], 8), scene_title, font=font, fill=CYAN)
    draw.rectangle([(MARGIN[0]-5, 40), (W-MARGIN[0]+5, H-MARGIN[1]+5)],
                   outline=(40, 40, 60), width=1)
    draw.rectangle([(0, H-25), (W, H)], fill=HEADER_BG)
    draw.text((MARGIN[0], H-22), f"  typing... line {cursor_pos+1}/{len(lines)}",
              font=font, fill=GRAY)
    y = 50
    start = max(0, cursor_pos - 18)
    visible = lines[start:start+19]
    for i, (t, text) in enumerate(visible):
        color_map = {'comment': GRAY, 'code': GREEN, 'cmd': CYAN,
                     'out': WHITE, 'blank': BG, 'key': YELLOW}
        color = color_map.get(t, WHITE)
        if t == 'code':
            if text.strip().startswith('#'): color = GRAY
            elif any(kw in text for kw in ['def ','class ','import','from ',
                    'if ','for ','while ','return ','elif ','else:','try:']):
                color = CYAN
            elif '=' in text and not text.strip().startswith('#'):
                color = YELLOW
        draw.text((MARGIN[0], y), text, font=font, fill=color)
        y += LINE_H
    if cursor_visible and 0 <= cursor_pos - start < 19:
        cy = 50 + (cursor_pos - start) * LINE_H
        cx = MARGIN[0] + len(lines[cursor_pos][1]) * int(FONT_SIZE * 0.55)
        draw.line([(cx, cy+2), (cx+8, cy+2), (cx+8, cy+LINE_H-6), (cx, cy+LINE_H-6)],
                   fill=CURSOR, width=2)


def render_video(scenes, output_path):
    ffmpeg = subprocess.Popen([
        "ffmpeg", "-y", "-f", "image2pipe", "-framerate", str(FPS),
        "-i", "-", "-c:v", "libx264", "-preset", "fast", "-crf", "28",
        "-pix_fmt", "yuv420p", "-vf", f"scale={W}:{H}", output_path
    ], stdin=subprocess.PIPE, bufsize=10*1024*1024)

    total_frames = 0
    for scene_title, scene_lines in scenes:
        displayed = []
        for line_type, text in scene_lines:
            displayed.append((line_type, text))
            cursor_line = len(displayed) - 1

            if line_type in ('code', 'cmd'):
                for ch_idx in range(len(text) + 1):
                    partial = displayed.copy()
                    partial[-1] = (line_type, text[:ch_idx])
                    for blink in range(2):
                        img = Image.new("RGB", (W, H), BG)
                        draw = ImageDraw.Draw(img)
                        make_frame(draw, partial, cursor_line, scene_title, blink == 0)
                        img.save(ffmpeg.stdin, "PNG")
                        total_frames += 1
                for _ in range(4):
                    img = Image.new("RGB", (W, H), BG)
                    draw = ImageDraw.Draw(img)
                    make_frame(draw, displayed, cursor_line, scene_title, True)
                    img.save(ffmpeg.stdin, "PNG")
                    total_frames += 1
            else:
                for _ in range(6):
                    img = Image.new("RGB", (W, H), BG)
                    draw = ImageDraw.Draw(img)
                    make_frame(draw, displayed, cursor_line, scene_title, False)
                    img.save(ffmpeg.stdin, "PNG")
                    total_frames += 1
        for _ in range(15):
            img = Image.new("RGB", (W, H), BG)
            draw = ImageDraw.Draw(img)
            make_frame(draw, displayed, len(displayed)-1, scene_title, False)
            img.save(ffmpeg.stdin, "PNG")
            total_frames += 1
    for _ in range(30):
        img = Image.new("RGB", (W, H), BG)
        draw = ImageDraw.Draw(img)
        make_frame(draw, displayed, len(displayed)-1, "✅ EV-AI Demo Complete!", False)
        img.save(ffmpeg.stdin, "PNG")
        total_frames += 1
    ffmpeg.stdin.close()
    ffmpeg.wait()
    return total_frames


# ══════════════════════════════════════════════
# EV-AI Scenes
# ══════════════════════════════════════════════

SCENES = [
    ("⚡ EV-AI Project Overview",
     [("cmd", "~/Projects/ev-ai$ ls -la"),
      ("out", "total 32"),
      ("out", "drwxr-xr-x 6 user user 4096 Jul 10  frontend/"),
      ("out", "  ├── index.html     — Dashboard UI with HUD"),
      ("out", "  ├── style.css      — Electric vehicle theme"),
      ("out", "  ├── ev_model.js    — 3D EV built from primitives"),
      ("out", "  ├── ai_agent.js    — Autonomous driving brain"),
      ("out", "  └── sketch.js      — p5.js WEBGL 3D renderer"),
      ("out", ""),
      ("out", "Goal: AI-controlled 3D electric vehicle simulator")]),

    ("🏗️ 3D EV Model — Body Construction",
     [("code", "class EVModel {"),
      ("code", "  constructor() {"),
      ("code", "    this.length = 4.2; this.width = 1.8;"),
      ("code", "    this.height = 1.4;"),
      ("code", "    this.wheelRadius = 0.32;"),
      ("code", "    this.pos = createVector(0, 0, 0);"),
      ("code", "    this.rotation = 0;"),
      ("code", "    this.speed = 0;"),
      ("code", "    this.battery = 85;"),
      ("code", "  }")]),

    ("🏗️ 3D EV Model — Rendering",
     [("code", "  render() {"),
      ("code", "    push();"),
      ("code", "    translate(this.pos.x, 0, this.pos.z);"),
      ("code", "    rotateY(this.rotation);"),
      ("comment", "    // Main body — electric blue"),
      ("code", "    fill(30, 180, 255);"),
      ("code", "    specularMaterial(30, 180, 255);"),
      ("code", "    box(len*0.95, h*0.5, w*0.95);"),
      ("code", ""),
      ("comment", "    // Windshield glass"),
      ("code", "    fill(100, 200, 255, 80);"),
      ("code", "    specularMaterial(150, 200, 255);"),
      ("code", "    box(len*0.3, h*0.3, w*0.8);"),
      ("code", "  }")]),

    ("🏗️ 3D EV Model — Wheels & Lights",
     [("code", "    for (let [wx, wz] of wheelPositions) {"),
      ("code", "      push();"),
      ("code", "      translate(wx, radius+0.05, wz);"),
      ("comment", "      // Steering on front wheels"),
      ("code", "      if (isFront) rotateY(this.steerAngle);"),
      ("code", "      rotateX(this.speed * 4.5);  // spin"),
      ("code", "      cylinder(this.wheelRadius, 0.22);"),
      ("code", "      pop();"),
      ("code", "    }"),
      ("code", ""),
      ("comment", "    // Headlights (emissive when on)"),
      ("code", "    if (this.lightOn) emissiveMaterial(200,200,100);"),
      ("code", "    sphere(0.08);"),
      ("code", ""),
      ("comment", "    // Brake lights (red when braking)"),
      ("code", "    if (this.brakeActive) emissiveMaterial(255,0,0);")]),

    ("🧠 AI Agent — Sensor System",
     [("code", "class AIAgent {"),
      ("code", "  constructor(ev) {"),
      ("code", "    this.ev = ev;"),
      ("code", "    this.sensors = {"),
      ("code", "      fl: { angle: -0.4, range: 60 },"),
      ("code", "      fm: { angle: 0,    range: 50 },"),
      ("code", "      fr: { angle: 0.4,  range: 60 },"),
      ("code", "      sl: { angle: -PI/2, range: 30 },"),
      ("code", "      sr: { angle:  PI/2, range: 30 },"),
      ("code", "      rl: { angle: -2.7, range: 20 },"),
      ("code", "      rm: { angle: PI,    range: 15 },"),
      ("code", "      rr: { angle: 2.7,  range: 20 },"),
      ("code", "    };"),
      ("code", "    this.state = 'following';"),
      ("code", "  }")]),

    ("🧠 AI Agent — Sensor Raycasting",
     [("code", "  updateSensors() {"),
      ("code", "    for (const [key, sensor] of this.sensors) {"),
      ("code", "      const angle = ev.rotation + sensor.angle;"),
      ("code", "      let minDist = sensor.range;"),
      ("code", "      for (const obs of this.obstacles) {"),
      ("code", "        const dx = obs.pos.x - origin.x;"),
      ("code", "        const dz = obs.pos.z - origin.z;"),
      ("code", "        const dist = sqrt(dx*dx + dz*dz);"),
      ("code", "        if (abs(angleDiff) < 0.4 && dist < range) {"),
      ("code", "          minDist = min(minDist, dist);"),
      ("code", "          hit = true;"),
      ("code", "        }"),
      ("code", "      }"),
      ("code", "      sensor.distance = minDist;"),
      ("code", "      sensor.active = hit && dist < range*0.7;"),
      ("code", "    }"),
      ("code", "  }")]),

    ("🧠 AI Agent — Path Following",
     [("code", "  decide(dt) {"),
      ("code", "    const target = this.waypoints[current];"),
      ("code", "    const angleError = angleDiff(targetAngle, rot);"),
      ("code", ""),
      ("comment", "    // Pure pursuit steering"),
      ("code", "    steer = constrain(lookError * 2.0, -0.5, 0.5);"),
      ("code", ""),
      ("comment", "    // Speed control by curvature"),
      ("code", "    const curvature = abs(lookError);"),
      ("code", "    const targetSpeed = map(curv, 0, 0.8, 25, 8);"),
      ("code", "    if (speedError > 0) throttle = speedError*0.05;"),
      ("code", "    else if (speedError < -1) brake = -speedError*0.03;"),
      ("code", "  }")]),

    ("🧠 AI Agent — Obstacle Avoidance",
     [("code", "    if (!frontClear && ev.speed > 2) {"),
      ("code", "      state = 'obstacle_avoidance';"),
      ("code", "      if (leftClear) {"),
      ("code", "        steer = -0.5; throttle = 0.3;"),
      ("code", "        decision = 'Steering left';"),
      ("code", "      } else if (rightClear) {"),
      ("code", "        steer = 0.5; throttle = 0.3;"),
      ("code", "        decision = 'Steering right';"),
      ("code", "      } else {"),
      ("code", "        brake = 0.8;"),
      ("code", "        decision = 'Emergency braking!';"),
      ("code", "      }"),
      ("code", "    }"),
      ("code", "    if (battery < 15) {"),
      ("code", "      throttle = min(throttle, 0.3);"),
      ("code", "      decision = '⚡ Eco mode';"),
      ("code", "    }")]),

    ("🎨 Main Sketch — 3D Rendering",
     [("code", "function setup() {"),
      ("code", "  canvas = createCanvas(w, h, WEBGL);"),
      ("code", "  ev = new EVModel();"),
      ("code", "  ai = new AIAgent(ev);"),
      ("code", "  ev.pos = ai.waypoints[0].copy();"),
      ("code", "}"),
      ("code", ""),
      ("code", "function draw() {"),
      ("code", "  background(8, 8, 25);"),
      ("code", "  ambientLight(60, 60, 100);"),
      ("code", "  directionalLight(180, 180, 220, 0.5, -0.8, -0.3);"),
      ("code", "  if (!paused) ai.tick(dt);"),
      ("code", "  setCamera();"),
      ("code", "  ai.renderDebug();"),
      ("code", "  ev.render();"),
      ("code", "  updateDashboard();"),
      ("code", "}")]),

    ("🎥 Camera Modes",
     [("code", "function setCamera() {"),
      ("code", "  switch (cameraMode) {"),
      ("code", "    case 0: // Chase camera"),
      ("code", "      camera(pos.x-cos(rot)*8, 4, pos.z-sin(rot)*8,"),
      ("code", "             pos.x, 0.5, pos.z, 0, 1, 0);"),
      ("code", "      break;"),
      ("code", "    case 1: // Top-down"),
      ("code", "      camera(target.x, 20, target.z+0.1,"),
      ("code", "             target.x, 0, target.z, 0, 0, -1);"),
      ("code", "      break;"),
      ("code", "    case 3: // First-person (from driver seat)"),
      ("code", "      camera(fpX, fpY, fpZ, fwdX, fwdY-0.2, fwdZ,"),
      ("code", "             0, 1, 0);"),
      ("code", "      break;"),
      ("code", "  }"),
      ("code", "}")]),

    ("📊 Dashboard — Real-time HUD",
     [("code", "function updateDashboard() {"),
      ("code", "  const speedKmh = round(ev.speed * 3.6);"),
      ("code", "  const batteryPct = round(constrain(ev.battery,0,100));"),
      ("code", "  dashSpeed.textContent = speedKmh;"),
      ("code", "  dashBattery.textContent = batteryPct;"),
      ("code", "  batteryFill.style.width = batteryPct + '%';"),
      ("code", "  if (batteryPct < 20) fill.style.background = '#ff1744';"),
      ("code", "  if (speedKmh > 100) speedEl.style.color = '#ff1744';"),
      ("code", "  aiMode.textContent = ai.state;"),
      ("code", "  aiDecision.textContent = ai.decision;"),
      ("code", "  aiConfidence.textContent = round(ai.confidence*100)+'%';"),
      ("code", "}")]),

    ("⚡ EV-AI in Action!",
     [("out", "  ✓ 3D electric vehicle built from primitives"),
      ("out", "  ✓ AI agent with 8-sensor array + raycasting"),
      ("out", "  ✓ Path following with pure pursuit algorithm"),
      ("out", "  ✓ Obstacle avoidance with state machine"),
      ("out", "  ✓ Battery management & eco mode"),
      ("out", "  ✓ 4 camera modes: Chase, Top, Orbit, First-Person"),
      ("out", "  ✓ Real-time dashboard with speed/sensors/AI state"),
      ("out", ""),
      ("out", "  Built with 🔋 by Ibrahim — Version Extreme Cooperation 🇹🇿")]),
]


if __name__ == "__main__":
    output = "/home/cybertron/Projects/ev-ai/ev_ai_coding_demo.mp4"
    t0 = time.time()
    print(f"🎬 Generating EV-AI demo video...")
    frames = render_video(SCENES, output)
    if os.path.exists(output):
        size = os.path.getsize(output) / 1048576
        duration = frames // FPS
        print(f"\n✅ {output}")
        print(f"   Duration: ~{duration}s ({frames} frames @ {FPS}fps)")
        print(f"   Size: {size:.1f} MB")
        print(f"   Render time: {time.time()-t0:.0f}s")
    else:
        print(f"\n❌ Failed to generate video")
        sys.exit(1)
