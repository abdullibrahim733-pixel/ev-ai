#!/usr/bin/env python3
"""EV-AI — 3D Electric Vehicle Model Generator
Generates a GLTF 3D car model using trimesh primitives.
Creates a detailed EV with body, wheels, windows, lights, and aero details.
"""

import json
import struct
import os
import math
from io import BytesIO

# ─── Construct a minimal GLTF 2.0 file without pygltflib ──────
# We use raw GLTF JSON + binary buffer for maximum compatibility

def vec3(x, y, z): return [x, y, z]

def build_ev_gltf():
    """Build a complete GLTF 2.0 electric vehicle model.
    Returns bytes of the .glb file."""

    # ─── Geometry data ─────────────────────────────────
    # All positions, normals, indices packed into one buffer

    positions = []
    normals = []
    indices = []
    base = 0  # vertex base index

    def add_mesh(verts, tris):
        """Add a mesh: verts is list of (x,y,z) tuples, tris is list of (i,j,k) tuples.
        Also computes flat normals."""
        nonlocal base
        idx_offset = len(positions)
        positions.extend(verts)
        # Compute normals per face
        face_normals = []
        for i0, i1, i2 in tris:
            v0 = verts[i0]; v1 = verts[i1]; v2 = verts[i2]
            nx = (v1[1]-v0[1])*(v2[2]-v0[2]) - (v1[2]-v0[2])*(v2[1]-v0[1])
            ny = (v1[2]-v0[2])*(v2[0]-v0[0]) - (v1[0]-v0[0])*(v2[2]-v0[2])
            nz = (v1[0]-v0[0])*(v2[1]-v0[1]) - (v1[1]-v0[1])*(v2[0]-v0[0])
            length = math.sqrt(nx*nx + ny*ny + nz*nz)
            if length > 0:
                nx /= length; ny /= length; nz /= length
            face_normals.append((nx, ny, nz))
        # Add vertex normals (average per vertex for now, just use face normals)
        # For simplicity, duplicate vertices per face so each vertex has one normal
        new_positions = []
        new_normals = []
        new_indices = []
        for fi, (i0, i1, i2) in enumerate(tris):
            n = face_normals[fi]
            for vi in [i0, i1, i2]:
                new_positions.append(verts[vi])
                new_normals.append(n)
            new_indices.append(base + fi*3)
            new_indices.append(base + fi*3 + 1)
            new_indices.append(base + fi*3 + 2)
            base += 3
        # Add to global arrays (with index offset - we already used base correctly)
        # Actually let's just add after computing
        positions.extend(new_positions[len(positions)-idx_offset:])
        normals.extend(new_normals)
        indices.extend(new_indices)

    # Reset and rebuild properly
    positions = []
    normals = []
    indices = []
    base = 0

    def add_box(cx, cy, cz, sx, sy, sz):
        """Add a box centered at (cx,cy,cz) with size (sx,sy,sz).
        Returns number of vertices added."""
        nonlocal base
        hx, hy, hz = sx/2, sy/2, sz/2
        verts = [
            vec3(cx-hx, cy-hy, cz-hz), vec3(cx+hx, cy-hy, cz-hz),
            vec3(cx+hx, cy+hy, cz-hz), vec3(cx-hx, cy+hy, cz-hz),
            vec3(cx-hx, cy-hy, cz+hz), vec3(cx+hx, cy-hy, cz+hz),
            vec3(cx+hx, cy+hy, cz+hz), vec3(cx-hx, cy+hy, cz+hz),
        ]
        tris = [
            (0,1,2),(0,2,3),  # front
            (1,5,6),(1,6,2),  # right
            (5,4,7),(5,7,6),  # back
            (4,0,3),(4,3,7),  # left
            (3,2,6),(3,6,7),  # top
            (4,5,1),(4,1,0),  # bottom
        ]
        for i0,i1,i2 in tris:
            v0=verts[i0]; v1=verts[i1]; v2=verts[i2]
            nx = (v1[1]-v0[1])*(v2[2]-v0[2])-(v1[2]-v0[2])*(v2[1]-v0[1])
            ny = (v1[2]-v0[2])*(v2[0]-v0[0])-(v1[0]-v0[0])*(v2[2]-v0[2])
            nz = (v1[0]-v0[0])*(v2[1]-v0[1])-(v1[1]-v0[1])*(v2[0]-v0[0])
            l = math.sqrt(nx*nx+ny*ny+nz*nz)
            if l>0: nx/=l; ny/=l; nz/=l
            for vi in [i0,i1,i2]:
                positions.append(verts[vi])
                normals.append((nx,ny,nz))
                indices.append(base)
                base += 1
        return 8

    def add_cylinder(cx, cy, cz, r, h, segments=16):
        """Add a cylinder along Y axis."""
        nonlocal base
        verts = []
        # Top ring
        for i in range(segments):
            a = 2*math.pi*i/segments
            verts.append(vec3(cx+r*math.cos(a), cy+h/2, cz+r*math.sin(a)))
        # Bottom ring
        for i in range(segments):
            a = 2*math.pi*i/segments
            verts.append(vec3(cx+r*math.cos(a), cy-h/2, cz+r*math.sin(a)))
        # Side faces
        for i in range(segments):
            n = i; n2 = (i+1)%segments
            b = segments + i; b2 = segments + (i+1)%segments
            # Two triangles per quad
            for tri in [(n, n2, b), (n2, b2, b)]:
                i0,i1,i2 = tri
                v0=verts[i0]; v1=verts[i1]; v2=verts[i2]
                nx = (v1[1]-v0[1])*(v2[2]-v0[2])-(v1[2]-v0[2])*(v2[1]-v0[1])
                ny = (v1[2]-v0[2])*(v2[0]-v0[0])-(v1[0]-v0[0])*(v2[2]-v0[2])
                nz = (v1[0]-v0[0])*(v2[1]-v0[1])-(v1[1]-v0[1])*(v2[0]-v0[0])
                l = math.sqrt(nx*nx+ny*ny+nz*nz)
                if l>0: nx/=l; ny/=l; nz/=l
                for vi in [i0,i1,i2]:
                    positions.append(verts[vi])
                    normals.append((nx,ny,nz))
                    indices.append(base)
                    base += 1
        return segments*2

    def add_sphere(cx, cy, cz, r, segments=12):
        """Add a UV sphere."""
        nonlocal base
        verts = []
        for j in range(segments+1):
            theta = math.pi * j / segments
            for i in range(segments+1):
                phi = 2*math.pi * i / segments
                x = cx + r * math.sin(theta) * math.cos(phi)
                y = cy + r * math.cos(theta)
                z = cz + r * math.sin(theta) * math.sin(phi)
                verts.append(vec3(x,y,z))
        for j in range(segments):
            for i in range(segments):
                a = j*(segments+1)+i
                b = a + segments + 1
                i0=a; i1=b; i2=a+1
                i3=b; i4=b+1; i5=a+1
                for tri in [(i0,i1,i2),(i3,i4,i5)]:
                    i0,i1,i2 = tri
                    v0=verts[i0]; v1=verts[i1]; v2=verts[i2]
                    nx=v0[0]-cx; ny=v0[1]-cy; nz=v0[2]-cz
                    l=math.sqrt(nx*nx+ny*ny+nz*nz)
                    if l>0: nx/=l; ny/=l; nz/=l
                    for vi in [i0,i1,i2]:
                        positions.append(verts[vi])
                        normals.append((nx,ny,nz))
                        indices.append(base)
                        base += 1
        return (segments+1)*(segments+1)

    # ─── Build the Electric Vehicle ──────────────────
    # Scale: 1 unit ≈ 1 meter
    # Body dimensions (like a Tesla Model 3)
    body_len = 4.7
    body_wid = 1.85
    body_hgt = 1.15
    ground_clearance = 0.15

    cy = ground_clearance + body_hgt/2

    # Main body (lower)
    add_box(0, cy, 0, body_len*0.9, body_hgt*0.55, body_wid*0.92)

    # Cabin / roof (upper body)
    cabin_cy = cy + body_hgt*0.45
    add_box(0, cabin_cy, 0, body_len*0.55, body_hgt*0.35, body_wid*0.85)

    # Front bumper
    add_box(body_len*0.42, cy-0.05, 0, body_len*0.08, body_hgt*0.35, body_wid*0.88)

    # Rear bumper
    add_box(-body_len*0.42, cy-0.05, 0, body_len*0.08, body_hgt*0.35, body_wid*0.88)

    # Wheels (4)
    wheel_r = 0.33
    wheel_w = 0.18
    w_positions = [
        ( body_len*0.3,  ground_clearance + wheel_r,  body_wid*0.52),
        ( body_len*0.3,  ground_clearance + wheel_r, -body_wid*0.52),
        (-body_len*0.28, ground_clearance + wheel_r,  body_wid*0.52),
        (-body_len*0.28, ground_clearance + wheel_r, -body_wid*0.52),
    ]
    for wx, wy, wz in w_positions:
        add_cylinder(wx, wy, wz, wheel_r, wheel_w, 14)

    # Headlights
    add_box(body_len*0.44, cy, body_wid*0.3, 0.04, 0.08, 0.25)
    add_box(body_len*0.44, cy, -body_wid*0.3, 0.04, 0.08, 0.25)

    # Tail lights
    add_box(-body_len*0.44, cy, body_wid*0.3, 0.04, 0.08, 0.22)
    add_box(-body_len*0.44, cy, -body_wid*0.3, 0.04, 0.08, 0.22)

    # Side mirrors
    add_box(body_len*0.25, cy+0.1, body_wid*0.52, 0.12, 0.06, 0.04)
    add_box(body_len*0.25, cy+0.1, -body_wid*0.52, 0.12, 0.06, 0.04)

    # Charging port (small detail)
    add_box(-body_len*0.3, cy-0.1, body_wid*0.48, 0.06, 0.05, 0.04)

    # ─── Pack into GLTF ────────────────────────────────
    # Interleave positions (3 floats) + normals (3 floats) = 6 floats per vertex
    vertex_count = len(positions)
    buffer_bytes = vertex_count * 6 * 4  # 6 floats * 4 bytes each

    buf = bytearray(buffer_bytes)
    offset = 0
    for i in range(vertex_count):
        p = positions[i]; n = normals[i]
        struct.pack_into('<fff', buf, offset, *p); offset += 12
        struct.pack_into('<fff', buf, offset, *n); offset += 12

    # ─── GLTF JSON ──────────────────────────────────────
    # Accessors: positions (0), normals (1), indices (2)
    # Buffer view: positions+normals (0), indices (1)

    index_bytes = bytearray(len(indices) * 2)  # unsigned short per index
    for i, idx in enumerate(indices):
        struct.pack_into('<H', index_bytes, i*2, idx)

    total_buffer = buffer_bytes + len(index_bytes)

    gltf = {
        "asset": {"version": "2.0", "generator": "EV-AI Python Model Generator"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{
            "mesh": 0,
            "name": "EV_Model",
            "translation": [0, 0, 0],
            "rotation": [0, 0, 0, 1],
            "scale": [1, 1, 1]
        }],
        "meshes": [{
            "primitives": [{
                "attributes": {
                    "POSITION": 0,
                    "NORMAL": 1
                },
                "indices": 2,
                "mode": 4  # TRIANGLES
            }],
            "name": "Electric_Vehicle"
        }],
        "accessors": [
            # POSITION accessor
            {
                "bufferView": 0,
                "componentType": 5126,  # FLOAT
                "count": vertex_count,
                "type": "VEC3",
                "min": [
                    min(p[0] for p in positions),
                    min(p[1] for p in positions),
                    min(p[2] for p in positions)
                ],
                "max": [
                    max(p[0] for p in positions),
                    max(p[1] for p in positions),
                    max(p[2] for p in positions)
                ]
            },
            # NORMAL accessor
            {
                "bufferView": 1,
                "componentType": 5126,  # FLOAT
                "count": vertex_count,
                "type": "VEC3"
            },
            # INDICES accessor
            {
                "bufferView": 2,
                "componentType": 5123,  # UNSIGNED_SHORT
                "count": len(indices),
                "type": "SCALAR"
            }
        ],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": vertex_count * 12, "target": 34962},      # positions
            {"buffer": 0, "byteOffset": vertex_count * 12, "byteLength": vertex_count * 12, "target": 34962},  # normals
            {"buffer": 1, "byteOffset": 0, "byteLength": len(index_bytes), "target": 34963}        # indices
        ],
        "buffers": [
            {"byteLength": buffer_bytes},
            {"byteLength": len(index_bytes)}
        ]
    }

    # ─── Build GLB binary ──────────────────────────
    # GLB header: magic (4), version (4), length (4)
    # JSON chunk: chunk length (4), chunk type (4), json (padded)
    # BIN chunk: chunk length (4), chunk type (4), bin (padded)

    json_str = json.dumps(gltf, separators=(',', ':'))
    # Pad JSON to 4-byte alignment with space
    json_pad = 4 - (len(json_str) % 4)
    if json_pad != 4:
        json_str += ' ' * json_pad
    json_chunk = json_str.encode('utf-8')

    # Combine both buffers into one BIN chunk
    combined_bin = bytes(buf) + bytes(index_bytes)
    bin_pad = 4 - (len(combined_bin) % 4)
    if bin_pad != 4:
        combined_bin += b'\x00' * bin_pad

    json_chunk_len = len(json_chunk)
    bin_chunk_len = len(combined_bin)

    total_len = 12 + 8 + json_chunk_len + 8 + bin_chunk_len

    glb = bytearray()
    # Header
    glb += b'glTF'
    glb += struct.pack('<I', 2)  # version 2
    glb += struct.pack('<I', total_len)
    # JSON chunk
    glb += struct.pack('<I', json_chunk_len)
    glb += b'JSON'
    glb += json_chunk
    # BIN chunk
    glb += struct.pack('<I', bin_chunk_len)
    glb += b'BIN\x00'
    glb += combined_bin

    return bytes(glb)


def build_ev_obj():
    """Build an OBJ string of the EV model."""
    # Import the geometry builder functions from above
    # Reuse the positions/normals/indices from build_ev_gltf logic
    # Actually just run the same geometry generation and export as OBJ

    positions = []
    normals = []
    indices = []
    base = 0

    # Same geometry functions as build_ev_gltf
    def add_box(cx, cy, cz, sx, sy, sz):
        nonlocal base
        hx, hy, hz = sx/2, sy/2, sz/2
        verts = [
            vec3(cx-hx, cy-hy, cz-hz), vec3(cx+hx, cy-hy, cz-hz),
            vec3(cx+hx, cy+hy, cz-hz), vec3(cx-hx, cy+hy, cz-hz),
            vec3(cx-hx, cy-hy, cz+hz), vec3(cx+hx, cy-hy, cz+hz),
            vec3(cx+hx, cy+hy, cz+hz), vec3(cx-hx, cy+hy, cz+hz),
        ]
        tris = [
            (0,1,2),(0,2,3),(1,5,6),(1,6,2),
            (5,4,7),(5,7,6),(4,0,3),(4,3,7),
            (3,2,6),(3,6,7),(4,5,1),(4,1,0),
        ]
        for i0,i1,i2 in tris:
            v0=verts[i0]; v1=verts[i1]; v2=verts[i2]
            nx=(v1[1]-v0[1])*(v2[2]-v0[2])-(v1[2]-v0[2])*(v2[1]-v0[1])
            ny=(v1[2]-v0[2])*(v2[0]-v0[0])-(v1[0]-v0[0])*(v2[2]-v0[2])
            nz=(v1[0]-v0[0])*(v2[1]-v0[1])-(v1[1]-v0[1])*(v2[0]-v0[0])
            l=math.sqrt(nx*nx+ny*ny+nz*nz)
            if l>0: nx/=l; ny/=l; nz/=l
            for vi in [i0,i1,i2]:
                positions.append(verts[vi])
                normals.append((nx,ny,nz))
                indices.append(base)
                base += 1

    def add_cylinder(cx, cy, cz, r, h, segments=16):
        nonlocal base
        verts = []
        for i in range(segments):
            a=2*math.pi*i/segments
            verts.append(vec3(cx+r*math.cos(a), cy+h/2, cz+r*math.sin(a)))
        for i in range(segments):
            a=2*math.pi*i/segments
            verts.append(vec3(cx+r*math.cos(a), cy-h/2, cz+r*math.sin(a)))
        for i in range(segments):
            n=i; n2=(i+1)%segments
            b=segments+i; b2=segments+(i+1)%segments
            for tri in [(n,n2,b),(n2,b2,b)]:
                i0,i1,i2=tri
                v0=verts[i0]; v1=verts[i1]; v2=verts[i2]
                nx=(v1[1]-v0[1])*(v2[2]-v0[2])-(v1[2]-v0[2])*(v2[1]-v0[1])
                ny=(v1[2]-v0[2])*(v2[0]-v0[0])-(v1[0]-v0[0])*(v2[2]-v0[2])
                nz=(v1[0]-v0[0])*(v2[1]-v0[1])-(v1[1]-v0[1])*(v2[0]-v0[0])
                l=math.sqrt(nx*nx+ny*ny+nz*nz)
                if l>0: nx/=l; ny/=l; nz/=l
                for vi in [i0,i1,i2]:
                    positions.append(verts[vi])
                    normals.append((nx,ny,nz))
                    indices.append(base)
                    base += 1

    # Build same geometry
    body_len, body_wid, body_hgt = 4.7, 1.85, 1.15
    cy = 0.15 + body_hgt/2
    add_box(0, cy, 0, body_len*0.9, body_hgt*0.55, body_wid*0.92)
    add_box(0, cy+body_hgt*0.45, 0, body_len*0.55, body_hgt*0.35, body_wid*0.85)
    add_box(body_len*0.42, cy-0.05, 0, body_len*0.08, body_hgt*0.35, body_wid*0.88)
    add_box(-body_len*0.42, cy-0.05, 0, body_len*0.08, body_hgt*0.35, body_wid*0.88)
    wr, ww = 0.33, 0.18
    for wx, wy, wz in [(body_len*0.3,0.15+wr,body_wid*0.52),(body_len*0.3,0.15+wr,-body_wid*0.52),
                        (-body_len*0.28,0.15+wr,body_wid*0.52),(-body_len*0.28,0.15+wr,-body_wid*0.52)]:
        add_cylinder(wx, wy, wz, wr, ww, 14)
    add_box(body_len*0.44, cy, body_wid*0.3, 0.04, 0.08, 0.25)
    add_box(body_len*0.44, cy, -body_wid*0.3, 0.04, 0.08, 0.25)
    add_box(-body_len*0.44, cy, body_wid*0.3, 0.04, 0.08, 0.22)
    add_box(-body_len*0.44, cy, -body_wid*0.3, 0.04, 0.08, 0.22)

    lines = ["# EV-AI Electric Vehicle (OBJ export)"]
    for p in positions:
        lines.append(f"v {p[0]:.6f} {p[1]:.6f} {p[2]:.6f}")
    for n in normals:
        lines.append(f"vn {n[0]:.6f} {n[1]:.6f} {n[2]:.6f}")
    # Faces (1-indexed in OBJ)
    for i in range(0, len(indices), 3):
        i0, i1, i2 = indices[i]+1, indices[i+1]+1, indices[i+2]+1
        lines.append(f"f {i0}//{i0} {i1}//{i1} {i2}//{i2}")
    return "\n".join(lines)


if __name__ == "__main__":
    base_dir = os.path.dirname(__file__)

    # Generate GLB
    glb = build_ev_gltf()
    glb_path = os.path.join(base_dir, "backend", "ev_model.glb")
    with open(glb_path, "wb") as f:
        f.write(glb)
    print(f"✅ Generated GLB model: {glb_path} ({len(glb)/1024:.1f} KB)")

    # Generate OBJ for p5.js compatibility
    obj = build_ev_obj()
    obj_path = os.path.join(base_dir, "backend", "ev_model.obj")
    with open(obj_path, "w") as f:
        f.write(obj)
    obj_kb = os.path.getsize(obj_path) / 1024
    print(f"✅ Generated OBJ model: {obj_path} ({obj_kb:.1f} KB)")

    print(f"\n🎯 Model files ready. Start the backend with:")
    print(f"   cd {base_dir} && backend/venv/bin/python backend/main.py")
