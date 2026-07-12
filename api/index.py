import os, sys, json
import urllib.request, urllib.error

# ─── Vercel Python Serverless: EV Model + API ───────
# This function serves the 3D EV model, simulation API,
# and Google AI Co-pilot chat when deployed on Vercel.

from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# ─── Google AI (Gemini) Configuration ──────────────
GOOGLE_AI_API_KEY = os.environ.get("GOOGLE_AI_API_KEY", "")
GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

SYSTEM_PROMPT = """You are EV-AI Co-pilot, the conversational AI assistant inside an autonomous electric vehicle simulation.

Your role:
- You read live telemetry from the vehicle: speed, battery, sensor readings, AI state, decisions, and waypoint progress.
- You answer questions naturally — like a helpful in-car AI assistant.
- You can interpret what the AI agent is doing and explain it in plain language.
- You give concise, useful responses (1-3 sentences max unless asked for detail).
- You're enthusiastic about electric vehicles, AI, and sustainable technology.

EV telemetry context will be provided in each message as JSON. Use it to give accurate, real-time answers.

Example interactions:
- "How's my battery?" → "85% remaining — about 42 km range. You're well within eco range."
- "What's the car doing?" → "Following the path at 65 km/h. Waypoint 23/64 ahead. AI confidence is 94%."
- "Tell the car to speed up" → "Throttle increased to 0.7. Target speed is now 80 km/h."
- "Explain pure pursuit" → "Pure pursuit calculates the steering angle needed to reach a lookahead point on the path ahead — like chasing a moving target."
"""

MODEL_DIR = os.path.dirname(__file__)
GLB_PATH = os.path.join(MODEL_DIR, "ev_model.glb")
OBJ_PATH = os.path.join(MODEL_DIR, "ev_model.obj")


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        params = parse_qs(parsed.query)

        # CORS headers
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

        try:
            if path == "/api/model" or path == "/api/model/":
                fmt = params.get("format", ["glb"])[0]
                if fmt == "obj":
                    if os.path.exists(OBJ_PATH):
                        self.send_header("Content-Type", "text/plain")
                        self.send_header("Content-Disposition", "attachment; filename=ev_model.obj")
                        self.end_headers()
                        with open(OBJ_PATH, "rb") as f:
                            self.wfile.write(f.read())
                        return
                    else:
                        self.send_header("Content-Type", "application/json")
                        self.end_headers()
                        self.wfile.write(json.dumps({"error": "OBJ model not found"}).encode())
                        return
                else:
                    if os.path.exists(GLB_PATH):
                        self.send_header("Content-Type", "model/gltf-binary")
                        self.send_header("Content-Disposition", "attachment; filename=ev_model.glb")
                        self.end_headers()
                        with open(GLB_PATH, "rb") as f:
                            self.wfile.write(f.read())
                        return
                    else:
                        self.send_header("Content-Type", "application/json")
                        self.end_headers()
                        self.wfile.write(json.dumps({"error": "GLB model not found"}).encode())
                        return

            elif path in ("/api/health", "/api/health/"):
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "healthy",
                    "model_exists": os.path.exists(GLB_PATH)
                }).encode())

            elif path in ("/api/model/info", "/api/model/info/"):
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                size_kb = round(os.path.getsize(GLB_PATH) / 1024, 1) if os.path.exists(GLB_PATH) else 0
                self.wfile.write(json.dumps({
                    "format": "gltf-binary",
                    "extension": ".glb",
                    "size_kb": size_kb,
                    "generator": "EV-AI Python Model Generator",
                    "description": "3D Electric Vehicle with body, cabin, wheels, lights, mirrors"
                }).encode())

            elif path in ("/api/", "/api"):
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "app": "EV-AI",
                    "version": "1.0.0",
                    "status": "running"
                }).encode())

            else:
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Not found", "path": path}).encode())

        except Exception as e:
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    # ════════════════════════════════════════════════
    # POST — Google AI Co-pilot Chat
    # ════════════════════════════════════════════════
    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        # CORS headers
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

        try:
            if path == "/api/ai/chat":
                self._handle_chat()
            else:
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": "POST not supported at this path"}).encode())
        except Exception as e:
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def _handle_chat(self):
        """Handle AI Co-pilot chat via Google AI (Gemini API)."""
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        data = json.loads(body.decode())

        user_message = data.get("message", "")
        context = data.get("context", {})

        if not user_message:
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"reply": "Please say something!", "action": None}).encode())
            return

        if not GOOGLE_AI_API_KEY:
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "reply": "Google AI API key not configured. Set GOOGLE_AI_API_KEY in Vercel environment variables.",
                "action": None
            }).encode())
            return

        # Build telemetry context string
        telemetry_parts = []
        if context:
            speed = context.get("speed", 0)
            battery = context.get("battery", 85)
            state = context.get("state", "Path Following")
            decision = context.get("decision", "Following path")
            waypoint = context.get("waypoint", 0)
            total_waypoints = context.get("totalWaypoints", 64)
            confidence = context.get("confidence", 0.95)
            sensor_readings = context.get("sensors", {})

            telemetry_parts.append(f"Speed: {round(speed * 3.6)} km/h ({round(speed, 1)} m/s)")
            telemetry_parts.append(f"Battery: {round(battery)}%")
            telemetry_parts.append(f"AI State: {state}")
            telemetry_parts.append(f"Decision: {decision}")
            telemetry_parts.append(f"Waypoint: {waypoint}/{total_waypoints}")
            telemetry_parts.append(f"AI Confidence: {round(confidence * 100)}%")

            sensors_str = ", ".join(
                f"{k}: {round(v.get('distance', 0), 1)}m{' ⚠' if v.get('active') else ''}"
                for k, v in sensor_readings.items()
            )
            if sensors_str:
                telemetry_parts.append(f"Sensors: [{sensors_str}]")

        telemetry_text = "\n".join(telemetry_parts) if telemetry_parts else "No telemetry data."

        # Call Gemini API
        try:
            payload = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": f"## Current Vehicle State\n{telemetry_text}\n\n## User Question\n{user_message}"}]
                    }
                ],
                "systemInstruction": {
                    "parts": [{"text": SYSTEM_PROMPT}]
                },
                "generationConfig": {
                    "temperature": 0.7,
                    "maxOutputTokens": 250,
                    "topP": 0.9
                }
            }

            req = urllib.request.Request(
                f"{GEMINI_API_URL}?key={GOOGLE_AI_API_KEY}",
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )

            with urllib.request.urlopen(req, timeout=10) as resp:
                result = json.loads(resp.read().decode())

            # Extract response text
            candidates = result.get("candidates", [])
            if candidates:
                reply = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "I'm not sure how to respond.")
            else:
                reply = "I couldn't process that request."

            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"reply": reply, "action": None}).encode())

        except urllib.error.HTTPError as e:
            error_body = e.read().decode()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "reply": f"Gemini API error ({e.code}). Check your API key and quota.",
                "error": error_body[:500],
                "action": None
            }).encode())
        except Exception as e:
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "reply": f"AI service error: {str(e)}",
                "action": None
            }).encode())
