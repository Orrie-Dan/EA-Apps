"""Trim the empty padding from the RSA logo. 80% of the source PNG is transparent."""
import os
from PIL import Image

SRC = os.path.expanduser("~/Pictures/Screenshots/RSA_Logo.png")
OUT = "public/images/logo-rsa.png"

im = Image.open(SRC).convert("RGBA")
bbox = im.getchannel("A").getbbox()
if bbox is None:
    raise SystemExit("logo has no opaque pixels")
im = im.crop(bbox)

# Nav renders it at 32px tall on a 2x display; 96px tall covers 3x.
h = 96
im = im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
os.makedirs("public/images", exist_ok=True)
im.save(OUT)
print(f"logo {im.width}x{im.height} -> {OUT} ({os.path.getsize(OUT)/1000:.1f} KB)")
