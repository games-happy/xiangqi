import math
from PIL import Image, ImageDraw, ImageFont

FONT = "/System/Library/Fonts/STHeiti Light.ttc"
WOOD = (122, 74, 30)
DISC = (247, 233, 200)
RED = (183, 28, 28)


def rounded_bg(S, color, radius):
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=radius, fill=color)
    return img, d


def make(S, out, maskable=False):
    img, d = rounded_bg(S, WOOD, int(S * 0.18))
    cx = cy = S / 2
    if maskable:
        R = S * 0.30
    else:
        R = S * 0.40
    # disc
    d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=DISC,
              outline=RED, width=max(2, int(S * 0.025)))
    d.ellipse([cx - R * 0.82, cy - R * 0.82, cx + R * 0.82, cy + R * 0.82],
              outline=RED, width=max(1, int(S * 0.012)))
    # text
    try:
        f = ImageFont.truetype(FONT, int(R * 1.1), index=0)
    except Exception:
        f = ImageFont.load_default()
    t = "帅"
    bb = d.textbbox((0, 0), t, font=f)
    tw = bb[2] - bb[0]
    th = bb[3] - bb[1]
    d.text((cx - tw / 2 - bb[0], cy - th / 2 - bb[1]), t, font=f, fill=RED)
    img.save(out)
    print("wrote", out)


make(192, "icon-192.png", maskable=False)
make(512, "icon-512.png", maskable=False)
make(512, "icon-maskable-512.png", maskable=True)
