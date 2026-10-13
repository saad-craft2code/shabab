#!/usr/bin/env python3
"""Process Shabab Express brand assets:
- logo:      trim white margins -> clean PNG (kept white bg for PDF/UI)
- signature: crop artifacts, near-white -> transparent PNG (alpha), tight trim
"""
from PIL import Image, ImageOps
import os

UP = "/home/z/my-project/upload"
PUB = "/home/z/my-project/public"
os.makedirs(PUB, exist_ok=True)

# ---------- LOGO ----------
logo = Image.open(f"{UP}/PHOTO-2026-10-14-03-59-06.jpg").convert("RGB")
# trim near-white border
gray = logo.convert("L")
bw = gray.point(lambda p: 0 if p > 245 else 255)
bbox = bw.getbbox()
if bbox:
    pad = 12
    bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad),
            min(logo.width, bbox[2] + pad), min(logo.height, bbox[3] + pad))
    logo = logo.crop(bbox)
# resize to reasonable web size (keep aspect)
if logo.width > 800:
    ratio = 800 / logo.width
    logo = logo.resize((800, int(logo.height * ratio)), Image.LANCZOS)
logo.save(f"{PUB}/shabab-logo.png", optimize=True)
print("logo:", logo.size, "-> public/shabab-logo.png")

# ---------- SIGNATURE ----------
sig = Image.open(f"{UP}/PHOTO-2026-10-14-03-58-25.jpg").convert("RGB")
# crop purple artifact: bottom-right corner (x > 78% width, y > 60% height)
w, h = sig.size
crop_x = int(w * 0.80)
crop_y = int(h * 0.62)
region = sig.crop((crop_x, crop_y, w, h))
region_gray = region.convert("L")
# artifact is light purple; anything in that region that is not near-white gets erased
px = region.load()
for y in range(region.height):
    for x in range(region.width):
        r, g, b = px[x, y]
        if (b > r + 15 and b > g + 10) or (r > 140 and b > 140 and g < 140):
            px[x, y] = (255, 255, 255)
# now: near-white -> transparent
sig = sig.convert("RGBA")
data = sig.getdata()
new = []
for r, g, b, a in data:
    lum = (r + g + b) / 3
    if lum > 235:
        new.append((255, 255, 255, 0))
    elif lum > 200:
        # soften edges
        alpha = int((235 - lum) / 35 * 255)
        new.append((30, 30, 30, max(0, min(255, alpha))))
    else:
        new.append((20, 20, 20, a if a else 255))
sig.putdata(new)
# trim to content
alpha = sig.split()[3]
bbox = alpha.getbbox()
if bbox:
    pad = 10
    bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad),
            min(sig.width, bbox[2] + pad), min(sig.height, bbox[3] + pad))
    sig = sig.crop(bbox)
if sig.width > 600:
    ratio = 600 / sig.width
    sig = sig.resize((600, int(sig.height * ratio)), Image.LANCZOS)
sig.save(f"{PUB}/shabab-signature.png", optimize=True)
print("signature:", sig.size, "-> public/shabab-signature.png")
