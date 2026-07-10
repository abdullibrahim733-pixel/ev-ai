# EV-AI ⚡🤖

**Autonomous Electric Vehicle — 3D AI Driving Simulator**

[![Live Demo](https://img.shields.io/badge/Live-Demo-00e5ff?logo=github)](https://abdullibrahim733-pixel.github.io/ev-ai/)

An AI-controlled electric vehicle built with p5.js WEBGL 3D. The car drives autonomously using sensor raycasting, path following, and obstacle avoidance — all in your browser.

## 🎥 Demo Video

[Watch the coding demo](https://github.com/abdullibrahim733-pixel/ev-ai/releases) showing the entire project being built, character by character.

## 🧠 How It Works

### 3D Electric Vehicle
- **Body**: Constructed from p5.js primitives (boxes, cylinders, spheres)
- **Wheels**: 4 individually rendered with rims and spokes
- **Lights**: Headlights (emissive), brake lights (red when braking)
- **Suspension**: Subtle bob effect from road movement
- **Glass**: Semi-transparent windshield and rear window

### AI Agent Controller
| System | Description |
|--------|-------------|
| **Sensors** | 8 directional raycast sensors (front, sides, rear) |
| **Path Following** | Pure pursuit algorithm with look-ahead waypoints |
| **Obstacle Avoidance** | State machine: follow → avoid → recover |
| **Speed Control** | Adaptive to path curvature |
| **Battery Management** | Eco mode below 15%, range calculation |

### Dashboard
- Speed (km/h), Battery %, Steering angle, Range
- AI state, decision, confidence level
- Live sensor visualization (green/yellow/red)
- 4 camera modes: Chase, Top-Down, Orbit, First-Person

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/abdullibrahim733-pixel/ev-ai.git
cd ev-ai/frontend

# Serve locally
python3 -m http.server 8080
# Open http://localhost:8080
```

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| 3D Engine | p5.js WEBGL |
| AI Logic | Custom agent (sensors, path following, state machine) |
| UI | HTML5 + CSS3 |
| Video | Pillow + ffmpeg (synthetic terminal demo) |
| Deployment | GitHub Pages |

## 📁 Project Structure

```
ev-ai/
├── frontend/
│   ├── index.html       # Dashboard HUD + 3D canvas
│   ├── style.css        # Electric vehicle theme
│   ├── ev_model.js      # 3D EV class (rendering, physics)
│   ├── ai_agent.js      # AI driving agent (sensors, decisions)
│   └── sketch.js        # p5.js main loop, camera, UI bridge
├── gen_ev_ai_demo.py   # Terminal-style coding demo video
├── ev_ai_coding_demo.mp4  # Generated demo video
└── README.md
```

Built with ⚡ by **Ibrahim** — Version Extreme Cooperation 🇹🇿
