"""EV-AI Backend — 3D Model Server + AI Agent API
FastAPI server that serves the 3D EV model, runs AI agent logic,
and provides a REST API for the frontend.
"""

import os
import json
import math
import random
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

app = FastAPI(
    title="EV-AI Backend",
    description="3D Electric Vehicle AI Agent — Model Server & Simulation API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "ev_model.glb")
SIMULATION_STATE = {
    "position": [0.0, 0.0, 0.0],
    "rotation": 0.0,
    "speed": 0.0,
    "battery": 85.0,
    "steering": 0.0,
    "throttle": 0.0,
    "brake": 0.0,
    "state": "path_following",
    "decision": "Accelerating",
    "confidence": 0.92,
    "waypoint": 0,
    "total_waypoints": 64,
    "obstacles_detected": 0,
    "frametime_ms": 16.7,
    "range_km": 320,
    "camera_mode": 0,
}

# ─── API Endpoints ──────────────────────────────

@app.get("/")
async def root():
    return {
        "app": "EV-AI",
        "version": "1.0.0",
        "status": "running",
        "model": "/api/model",
        "docs": "/docs"
    }


@app.get("/api/model")
async def get_model(format: str = "glb"):
    """Serve the 3D EV model as GLTF Binary (.glb) or Wavefront OBJ (.obj)."""
    if format == "obj":
        obj_path = MODEL_PATH.replace(".glb", ".obj")
        if not os.path.exists(obj_path):
            raise HTTPException(status_code=404, detail="OBJ model not found.")
        return FileResponse(
            obj_path,
            media_type="text/plain",
            filename="ev_model.obj",
            headers={"Access-Control-Allow-Origin": "*"}
        )
    if not os.path.exists(MODEL_PATH):
        raise HTTPException(status_code=404, detail="Model not found. Run generate_model.py first.")
    return FileResponse(
        MODEL_PATH,
        media_type="model/gltf-binary",
        filename="ev_model.glb",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=3600"
        }
    )


@app.get("/api/model/info")
async def get_model_info():
    """Return metadata about the 3D EV model."""
    if not os.path.exists(MODEL_PATH):
        raise HTTPException(status_code=404, detail="Model not found")
    size_kb = os.path.getsize(MODEL_PATH) / 1024
    return {
        "format": "gltf-binary",
        "extension": ".glb",
        "size_kb": round(size_kb, 1),
        "generator": "EV-AI Python Model Generator",
        "description": "3D Electric Vehicle with body, cabin, wheels, lights, mirrors"
    }


@app.get("/api/status")
async def get_status():
    """Return current simulation state."""
    return SIMULATION_STATE


class ControlCommand(BaseModel):
    action: str  # "pause", "resume", "reset", "set_camera", "set_mode"
    value: float | None = None


@app.post("/api/control")
async def set_control(cmd: ControlCommand):
    """Send control commands to the simulation."""
    if cmd.action == "reset":
        SIMULATION_STATE["position"] = [0.0, 0.0, 0.0]
        SIMULATION_STATE["rotation"] = 0.0
        SIMULATION_STATE["speed"] = 0.0
        SIMULATION_STATE["battery"] = 85.0
        SIMULATION_STATE["steering"] = 0.0
        SIMULATION_STATE["throttle"] = 0.0
        SIMULATION_STATE["brake"] = 0.0
        SIMULATION_STATE["state"] = "path_following"
        SIMULATION_STATE["decision"] = "Reset complete"
        SIMULATION_STATE["waypoint"] = 0
        return {"status": "ok", "message": "Simulation reset"}
    elif cmd.action == "set_camera":
        if cmd.value is not None:
            SIMULATION_STATE["camera_mode"] = int(cmd.value) % 4
            return {"status": "ok", "camera_mode": SIMULATION_STATE["camera_mode"]}
    return {"status": "ok"}


@app.get("/api/sensors")
async def get_sensors():
    """Simulate sensor readings for the frontend visualization."""
    sensors = {
        "fl": {"active": False, "distance": round(35 + random.uniform(0, 10), 1), "range": 60},
        "fm": {"active": False, "distance": round(28 + random.uniform(0, 8), 1), "range": 50},
        "fr": {"active": False, "distance": round(32 + random.uniform(0, 10), 1), "range": 60},
        "sl": {"active": False, "distance": round(18 + random.uniform(0, 5), 1), "range": 30},
        "sr": {"active": False, "distance": round(20 + random.uniform(0, 5), 1), "range": 30},
        "rl": {"active": False, "distance": round(12 + random.uniform(0, 3), 1), "range": 20},
        "rm": {"active": False, "distance": round(10 + random.uniform(0, 3), 1), "range": 15},
        "rr": {"active": False, "distance": round(14 + random.uniform(0, 3), 1), "range": 20},
    }
    return sensors


@app.get("/api/path")
async def get_path():
    """Return the oval track waypoints for visualization."""
    num_points = 36
    path = []
    for i in range(num_points):
        angle = 2 * math.pi * i / num_points
        x = 12 * math.cos(angle)
        z = 8.4 * math.sin(angle)
        path.append({"x": round(x, 3), "z": round(z, 3), "index": i})
    return {"waypoints": path, "total": num_points}


@app.get("/api/health")
async def health():
    return {"status": "healthy", "model_exists": os.path.exists(MODEL_PATH)}


# ─── Run ─────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    print(f"⚡ EV-AI Backend starting...")
    print(f"   Model: {MODEL_PATH} ({os.path.getsize(MODEL_PATH)/1024:.1f} KB)" if os.path.exists(MODEL_PATH)
          else f"   ⚠ Model not found. Run python3 generate_model.py first.")
    print(f"   API: http://localhost:8000")
    print(f"   Docs: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)
