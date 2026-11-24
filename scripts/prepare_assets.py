import json
import os
from collections import deque
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ASSETS_IN = os.path.join(ROOT, "rat_assets")
PUBLIC_ASSETS = os.path.join(ROOT, "public", "assets")
ICONS_OUT = os.path.join(PUBLIC_ASSETS, "icons")
PLAQUE_SRC = r"C:\Users\worsan\.gemini\antigravity\brain\f6a12bf2-59f3-4b6e-9b60-96f146f0c676\.user_uploaded\media_1795496405259_69893bb3.jpg"

os.makedirs(ICONS_OUT, exist_ok=True)


def has_real_transparency(img: Image.Image) -> bool:
    if img.mode != "RGBA":
        return False
    alpha = img.getchannel("A")
    lo, _ = alpha.getextrema()
    return lo < 250


def flood_remove_bg(img: Image.Image, target_rgb=None, tol_hard=22, tol_soft=42) -> Image.Image:
    """Flood-fill background from image edges so interior light fur stays intact."""
    rgba = img.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()

    if target_rgb is None:
        # Sample corners
        corners = [px[0, 0][:3], px[w - 1, 0][:3], px[0, h - 1][:3], px[w - 1, h - 1][:3]]
        target_rgb = tuple(sum(c[i] for c in corners) // 4 for i in range(3))

    def color_dist(rgb):
        return max(abs(rgb[0] - target_rgb[0]), abs(rgb[1] - target_rgb[1]), abs(rgb[2] - target_rgb[2]))

    visited = [[False] * w for _ in range(h)]
    q = deque()

    for x in range(w):
        for y in (0, h - 1):
            if color_dist(px[x, y][:3]) <= tol_soft:
                visited[y][x] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not visited[y][x] and color_dist(px[x, y][:3]) <= tol_soft:
                visited[y][x] = True
                q.append((x, y))

    bg_mask = [[False] * w for _ in range(h)]
    while q:
        cx, cy = q.popleft()
        bg_mask[cy][cx] = True
        for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                if color_dist(px[nx, ny][:3]) <= tol_soft:
                    visited[ny][nx] = True
                    q.append((nx, ny))

    for y in range(h):
        for x in range(w):
            if bg_mask[y][x]:
                r, g, b, a = px[x, y]
                d = color_dist((r, g, b))
                if d <= tol_hard:
                    px[x, y] = (r, g, b, 0)
                else:
                    t = (d - tol_hard) / max(1, (tol_soft - tol_hard))
                    px[x, y] = (r, g, b, int(a * t))
    return rgba


def fit_square(img: Image.Image, size: int, pad_ratio: float = 0.06) -> Image.Image:
    alpha = img.getchannel("A")
    # Threshold alpha > 16 to ignore ultra-faint shadow dust
    mask = alpha.point(lambda v: 255 if v > 16 else 0)
    bbox = mask.getbbox()
    if bbox:
        img = img.crop(bbox)
    w, h = img.size
    inner = int(size * (1.0 - pad_ratio * 2))
    scale = min(inner / max(1, w), inner / max(1, h))
    nw = max(1, int(round(w * scale)))
    nh = max(1, int(round(h * scale)))
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(resized, ((size - nw) // 2, (size - nh) // 2), resized)
    return canvas


def process_sheets():
    with open(os.path.join(ASSETS_IN, "manifest.json"), "r", encoding="utf-8") as f:
        manifest = json.load(f)

    for sheet_key in ["01_rats_colors", "02_rats_variants_poses", "03_furniture_toys", "04_care_ui"]:
        info = manifest[sheet_key]
        cols, rows = info["grid"]
        items = info["items"]
        path = os.path.join(ASSETS_IN, "originals", f"{sheet_key}.png")
        img = Image.open(path).convert("RGBA")
        w, h = img.size
        real_alpha = has_real_transparency(img)
        cw = w / cols
        ch = h / rows

        for idx, name in enumerate(items):
            r = idx // cols
            c = idx % cols
            box = (int(round(c * cw)), int(round(r * ch)), int(round((c + 1) * cw)), int(round((r + 1) * ch)))
            cell = img.crop(box)
            if not real_alpha:
                cell = flood_remove_bg(cell, target_rgb=(255, 255, 255), tol_hard=14, tol_soft=32)
            out = fit_square(cell, 256, pad_ratio=0.05)
            out.save(os.path.join(ICONS_OUT, f"{name}.png"), optimize=True)
        print(f"Sliced {sheet_key}: {len(items)} icons (alpha={real_alpha})")

    # 05_habitats (2x2)
    hab_path = os.path.join(ASSETS_IN, "originals", "05_habitats.png")
    hab = Image.open(hab_path).convert("RGBA")
    hw, hh = hab.size
    hab_items = manifest["05_habitats"]["items"]
    boxes = [
        (0, 0, int(hw * 0.53), int(hh * 0.52)),
        (int(hw * 0.52), 0, hw, int(hh * 0.54)),
        (0, int(hh * 0.52), int(hw * 0.60), hh),
        (int(hw * 0.58), int(hh * 0.54), hw, hh),
    ]
    for name, box in zip(hab_items, boxes):
        cell = flood_remove_bg(hab.crop(box), target_rgb=(255, 255, 255), tol_hard=14, tol_soft=30)
        out = fit_square(cell, 320, pad_ratio=0.04)
        out.save(os.path.join(ICONS_OUT, f"{name}.png"), optimize=True)
    print(f"Sliced 05_habitats: {len(hab_items)} icons")

    # 06_room background
    room_path = os.path.join(ASSETS_IN, "backgrounds", "06_room.png")
    room = Image.open(room_path).convert("RGB")
    room.thumbnail((1280, 1280), Image.Resampling.LANCZOS)
    room.save(os.path.join(PUBLIC_ASSETS, "room_bg.jpg"), quality=84, optimize=True)
    print("Saved room_bg.jpg")


def process_plaque():
    if not os.path.exists(PLAQUE_SRC):
        raise FileNotFoundError(f"Plaque not found at {PLAQUE_SRC}")
    img = Image.open(PLAQUE_SRC).convert("RGBA")
    cleaned = flood_remove_bg(img, tol_hard=26, tol_soft=44)
    alpha = cleaned.getchannel("A")
    bbox = alpha.point(lambda v: 255 if v > 32 else 0).getbbox()
    if bbox:
        cleaned = cleaned.crop(bbox)
    cleaned.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    out_path = os.path.join(PUBLIC_ASSETS, "dedication_plaque.png")
    cleaned.save(out_path, optimize=True)
    print(f"Saved dedication_plaque.png: {cleaned.size}")


def create_app_icon():
    rat_path = os.path.join(ICONS_OUT, "white_gray_back_stripe.png")
    rat = Image.open(rat_path).convert("RGBA")
    size = 512
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((16, 16, size - 16, size - 16), radius=104, fill=(247, 241, 229, 255), outline=(110, 133, 114, 255), width=20)
    rat_scaled = rat.resize((420, 420), Image.Resampling.LANCZOS)
    canvas.paste(rat_scaled, ((size - 420) // 2, (size - 420) // 2 + 12), rat_scaled)
    canvas.save(os.path.join(PUBLIC_ASSETS, "app_icon.png"), optimize=True)
    print("Saved app_icon.png")


if __name__ == "__main__":
    process_sheets()
    process_plaque()
    create_app_icon()
