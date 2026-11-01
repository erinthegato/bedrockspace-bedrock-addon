#!/usr/bin/env python3
"""Generate BedrockSpace art: 6-face space skybox cubemap + block/item textures.

Skybox faces are 128x128 Minecraft-style space art on a black background:
  - 4 horizontal faces: stars only
  - UP: planet + sun + stars
  - DOWN: black void (subtle stars)

Block/item textures are 16x16 opaque PNGs.

Run from project root:
    python BedrockSpace/tools/gen_bedrockspace.py
"""
from __future__ import annotations

import math
import os
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RP = ROOT / "BedrockSpace" / "resource_pack"
BP = ROOT / "BedrockSpace" / "behavior_pack"

# ---------------------------------------------------------------- help
def _rgba_to_rgba_bytes(pixel):
    r, g, b, a = pixel
    return bytes([r, g, b, a])

def _rgba_pixel(img, x, y):
    return img.getpixel((x, y))

# ---------------------------------------------------------------- skybox
SKY = 128

def _star(seed, x, y, brightness_range=(80, 255), size=1):
    # Deterministic star field from block coordinates.
    import hashlib

    h = hashlib.sha256(f"{seed}:{x}:{y}".encode()).digest()
    bx = int.from_bytes(h[:4], "big") / 0xFFFFFFFF
    by = int.from_bytes(h[4:8], "big") / 0xFFFFFFFF
    bright = int(
        brightness_range[0]
        + (brightness_range[1] - brightness_range[0])
        * (bx * 0.4 + by * 0.4 + (h[8] & 0x3F) / 128)
    )
    bright = max(brightness_range[0], min(brightness_range[1], bright))
    twinkle = (h[12] & 0x3F) / 0x3F
    if twinkle > 0.85:
        return bright + 40
    return bright

def _half_pixel(img, x, y):
    """Tint a pixel by a per-corner gradient to get Minecraft-style softening."""
    return img.getpixel((x, y))

def _gradient_v(x, y, top, bottom):
    t = y / (SKY - 1) if SKY > 1 else 0
    r = int(top[0] + (bottom[0] - top[0]) * t)
    g = int(top[1] + (bottom[1] - top[1]) * t)
    b = int(top[2] + (bottom[2] - top[2]) * t)
    return (r, g, b)

def _make_sky_face(face, seed):
    from PIL import Image, ImageDraw

    img = Image.new("RGB", (SKY, SKY), (0, 0, 0))
    px = img.load()

    if face == "UP":
        # Zenith: planet + sun + rich star field.
        planet_cx, planet_cy = SKY * 0.62, SKY * 0.30
        planet_r = 30
        sun_cx, sun_cy = SKY * 0.25, SKY * 0.70
        sun_r = 16

        # soft planet
        for y in range(SKY):
            for x in range(SKY):
                dx = x - planet_cx
                dy = y - planet_cy
                d = math.hypot(dx, dy)
                if d <= planet_r:
                    edge = d / planet_r
                    shade = 1.0 - edge * 0.55
                    # banded planet surface
                    band = int((math.atan2(dy, dx) + math.pi) / (2 * math.pi) * 6)
                    band_tint = [0.85, 0.75, 0.60][band % 3]
                    r = int(76 * band_tint * shade)
                    g = int(102 * shade)
                    b = int(140 * band_tint * shade)
                    px[x, y] = (r, g, b)
                elif d <= planet_r + 6:
                    # atmospheric glow
                    t = (d - planet_r) / 6
                    a = int(40 * (1 - t))
                    px[x, y] = (10, 20, 60)

        # sun
        for y in range(SKY):
            for x in range(SKY):
                dx = x - sun_cx
                dy = y - sun_cy
                d = math.hypot(dx, dy)
                if d <= sun_r:
                    edge = d / sun_r
                    # yellow-white core, orange edge
                    r = int(255 * (1 - edge * 0.4))
                    g = int(240 * (1 - edge * 0.55))
                    b = int(120 * (1 - edge))
                    px[x, y] = (r, g, b)
                elif d <= sun_r + 10:
                    t = (d - sun_r) / 10
                    px[x, y] = (255, 220, 120)

        # stars
        for y in range(SKY):
            for x in range(SKY):
                bright = _star(seed, x, y, brightness_range=(150, 255))
                if bright > 180:
                    px[x, y] = (bright, bright, bright)
                elif bright > 80:
                    px[x, y] = (bright // 2, bright // 2, bright)

    elif face == "DOWN":
        # Nadir: deeper void, very faint distant stars.
        for y in range(SKY):
            t = y / (SKY - 1) if SKY > 1 else 0
            base = int(4 + 6 * t)
            for x in range(SKY):
                bright = _star(seed, x, y, brightness_range=(10, base))
                if bright > 18:
                    px[x, y] = (bright, bright // 2 + 4, bright // 2)

    else:
        # Horizontal faces: stars on black.
        for y in range(SKY):
            t = y / (SKY - 1) if SKY > 1 else 0
            base = int(6 + 10 * t)
            for x in range(SKY):
                bright = _star(seed, x, y, brightness_range=(60, 255))
                if bright > 180:
                    px[x, y] = (bright, bright, bright)
                elif bright > 120:
                    px[x, y] = (bright // 2 + 20, bright // 2 + 20, bright)
                elif bright > 40:
                    px[x, y] = (bright // 2 + 10, bright // 2 + 10, bright // 2 + 10)

    return img

def _write_png(path, img):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, "PNG", optimize=True)

# ---------------------------------------------------------------- block / item textures
def _png_rgba(w, h, pixels):
    """pixels = list of (r,g,b,a) rows."""
    raw = b""
    for row in pixels:
        raw += b"\x00"
        for px in row:
            raw += struct.pack("BBBB", *px)
    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)
    os.makedirs(os.path.dirname(path := str(_PNG_PATH) if False else os.path.join(str(RP), "textures", "blocks")), exist_ok=True)
    return raw

def _make_rocket_fuel():
    from PIL import Image, ImageDraw

    img = Image.new("RGBA", (16, 16), (0, 0, 0, 255))
    d = ImageDraw.Draw(img)
    # rocket body
    d.rectangle([5, 2, 10, 13], fill=(54, 44, 36, 255))
    # nose cone
    d.polygon([(7, 1), (9, 1), (10, 6), (8, 9), (6, 9), (5, 6)], fill=(200, 80, 40, 255))
    # fins
    d.polygon([(4, 13), (6, 12), (6, 15), (4, 15)], fill=(110, 80, 50, 255))
    d.polygon([(10, 13), (12, 12), (12, 15), (10, 15)], fill=(110, 80, 50, 255))
    # window
    d.ellipse([6.5, 5, 9.5, 8], fill=(120, 180, 220, 255))
    return img

def _make_rocket_fuelled():
    img = _make_rocket_fuel()
    d = ImageDraw.Draw(img)
    # fuel glow stripe
    d.rectangle([6, 10, 9, 13], fill=(255, 160, 50, 200))
    return img

def _make_rocket_launch():
    img = _make_rocket_fuelled()
    d = ImageDraw.Draw(img)
    # launch flame
    d.polygon([(7, 15), (9, 15), (8.5, 24), (7.5, 24)], fill=(255, 200, 50, 255))
    d.polygon([(7.5, 15), (8.5, 15), (8, 20), (7.6, 20)], fill=(255, 255, 255, 255))
    return img

def _make_station():
    from PIL import Image, ImageDraw

    img = Image.new("RGBA", (16, 16), (0, 0, 0, 255))
    d = ImageDraw.Draw(img)
    # station frame
    d.rectangle([1, 4, 14, 11], fill=(40, 50, 70, 255), outline=(120, 150, 190, 255), width=1)
    # solar panels
    d.rectangle([0, 3, 15, 4], fill=(30, 60, 110, 255))
    d.rectangle([0, 11, 15, 12], fill=(30, 60, 110, 255))
    # core
    d.rectangle([6, 6, 9, 9], fill=(200, 120, 40, 255))
    # lights
    for lx, ly in [(2, 5), (13, 5), (2, 10), (13, 10)]:
        d.ellipse([lx - 0.5, ly - 0.5, lx + 0.5, ly + 0.5], fill=(255, 220, 80, 255))
    return img

def _make_astronaut_suit():
    from PIL import Image, ImageDraw

    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # suit body
    d.rectangle([4, 4, 11, 12], fill=(220, 220, 225, 255))
    # collar
    d.ellipse([5, 3, 10, 6], fill=(180, 180, 185, 255))
    # visor
    d.ellipse([5.5, 5.5, 10.5, 10.5], fill=(60, 140, 200, 255))
    # belt
    d.rectangle([4, 9, 11, 10], fill=(120, 120, 125, 255))
    return img

def _make_rocket_item():
    from PIL import Image, ImageDraw

    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([6, 4, 9, 11], fill=(54, 44, 36, 255))
    d.polygon([(7, 3), (9, 3), (9, 7), (7, 7)], fill=(200, 80, 40, 255))
    d.ellipse([7, 5.5, 9, 7.5], fill=(120, 180, 220, 255))
    return img

def _write_item_texture(name, img):
    path = RP / "textures" / "item_textures" / f"{name}.png"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, "PNG", optimize=True)

def _write_block_texture(name, img):
    path = RP / "textures" / "block_textures" / f"{name}.png"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, "PNG", optimize=True)

# ---------------------------------------------------------------- main
def main():
    from PIL import Image

    # Space cubemap
    cubemap_dir = RP / "textures" / "environment" / "space_cubemap"
    os.makedirs(cubemap_dir, exist_ok=True)
    faces = {
        "cubemap_0.png": "SOUTH",
        "cubemap_1.png": "EAST",
        "cubemap_2.png": "NORTH",
        "cubemap_3.png": "WEST",
        "cubemap_4.png": "UP",
        "cubemap_5.png": "DOWN",
    }
    for filename, face in faces.items():
        seed_map = {
            "SOUTH": 101,
            "EAST": 202,
            "NORTH": 303,
            "WEST": 404,
            "UP": 505,
            "DOWN": 606,
        }
        _write_png(cubemap_dir / filename, _make_sky_face(face, seed_map[face]))

    # Block textures
    _write_block_texture("bedrockspace_rocket_fuel", _make_rocket_fuel())
    _write_block_texture("bedrockspace_rocket_fuelled", _make_rocket_fuelled())
    _write_block_texture("bedrockspace_rocket_launch", _make_rocket_launch())
    _write_block_texture("bedrockspace_station", _make_station())

    # Item textures
    _write_item_texture("bedrockspace_rocket", _make_rocket_item())
    _write_item_texture("bedrockspace_astronaut_suit", _make_astronaut_suit())

    print("generated BedrockSpace art:", RP)

if __name__ == "__main__":
    main()
