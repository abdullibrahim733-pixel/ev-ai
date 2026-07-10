import os, sys, json

# ─── Vercel Python Serverless: EV Model + API ───────
# This function serves the 3D EV model and simulation API
# when deployed on Vercel's Python runtime.

from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

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
