from PIL import Image, ImageDraw

CANVAS_SIZE = 64
SCALE = 4  # 256x256 crisp pixel art

def create_sprite():
    return Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))

def finalize(img, path):
    scaled = img.resize((CANVAS_SIZE * SCALE, CANVAS_SIZE * SCALE), Image.Resampling.NEAREST)
    scaled.save(path, "PNG")
    print(f"Saved {path}")

def draw_light_flare(draw, cx, cy, color_rgb, size=4):
    r, g, b = color_rgb
    draw.ellipse([cx - size - 2, cy - size - 2, cx + size + 2, cy + size + 2], fill=(r, g, b, 70))
    draw.ellipse([cx - size, cy - size, cx + size, cy + size], fill=(r, g, b, 170))
    draw.ellipse([cx - 1, cy - 1, cx + 1, cy + 1], fill=(255, 255, 255, 255))

# ==========================================
# 1. MECHANIC & TOW SHOP (mechanic_shop.png)
# ==========================================
def make_mechanic_shop():
    img = create_sprite()
    d = ImageDraw.Draw(img)

    # Paved concrete apron & oil-stained service yard base
    d.rectangle([4, 8, 60, 60], fill="#334155")
    d.rectangle([5, 9, 59, 59], fill="#475569")

    # Building shadow
    d.rectangle([7, 14, 58, 52], fill=(0, 0, 0, 80))

    # Main garage structure (industrial steel blue-grey with orange safety stripe)
    d.rectangle([8, 12, 56, 48], fill="#1e293b")
    d.rectangle([9, 13, 55, 32], fill="#334155") # Roof
    d.rectangle([8, 32, 56, 35], fill="#f97316") # High-vis orange fascia band
    d.rectangle([9, 35, 55, 48], fill="#cbd5e1") # Front wall

    # Two roll-up service bay doors
    for bx in [13, 29]:
        d.rectangle([bx, 37, bx + 12, 48], fill="#0f172a")
        for ry in range(38, 48, 2):
            d.line([bx + 1, ry, bx + 11, ry], fill="#64748b")

    # Office door & window on right
    d.rectangle([45, 38, 52, 44], fill="#38bdf8")
    d.rectangle([46, 39, 51, 43], fill="#bae6fd")

    # Rooftop skylight & HVAC + Wrench/Tow sign
    d.rectangle([14, 16, 26, 26], fill="#0f172a")
    d.rectangle([15, 17, 25, 25], fill="#0284c7")
    # Orange Tow Hook / Wrench emblem on roof
    d.rectangle([34, 16, 50, 28], fill="#0f172a")
    d.rectangle([35, 17, 49, 27], fill="#f97316")
    d.rectangle([38, 20, 46, 24], fill="#ffffff")

    # Yellow floor safety markings in front of bays
    for x in [13, 29]:
        d.line([x, 50, x + 12, 50], fill="#facc15")

    finalize(img, "c:/Carlson/assets/commercial/mechanic_shop.png")

# ==========================================
# 2. HEAVY WRECKER TOW TRUCK (Base & Siren 1 & 2)
# ==========================================
def make_tow_truck(siren_frame=0):
    img = create_sprite()
    d = ImageDraw.Draw(img)
    x, y, w, l = 24, 14, 16, 36

    # Shadow
    d.rectangle([x - 1, y + 2, x + w + 1, y + l + 1], fill=(0, 0, 0, 80))

    # Wheels
    d.rectangle([x - 2, y + 5, x, y + 10], fill="#18181b")
    d.rectangle([x + w, y + 5, x + w + 2, y + 10], fill="#18181b")
    d.rectangle([x - 2, y + l - 10, x, y + l - 5], fill="#18181b")
    d.rectangle([x + w, y + l - 10, x + w + 2, y + l - 5], fill="#18181b")

    # Heavy Rear Flatbed / Wrecker Deck (dark steel)
    d.rectangle([x, y + 16, x + w, y + l], fill="#1e293b")
    d.rectangle([x + 1, y + 17, x + w - 1, y + l - 2], fill="#334155")
    # Yellow/Black hazard stripes at rear edge
    for cx in range(x, x + w, 4):
        d.rectangle([cx, y + l - 2, min(cx + 1, x + w), y + l], fill="#facc15")
        d.rectangle([min(cx + 2, x + w), y + l - 2, min(cx + 3, x + w), y + l], fill="#090d16")

    # Front Cab (High-Vis Amber / Golden Yellow)
    d.rectangle([x, y, x + w, y + 17], fill="#d97706")
    d.rectangle([x + 1, y + 1, x + w - 1, y + 16], fill="#f59e0b")

    # Windshield
    d.rectangle([x + 2, y + 5, x + w - 2, y + 9], fill="#38bdf8")

    # Center Tow Crane Boom & Winch Cable extending to rear hook
    d.rectangle([x + 6, y + 18, x + 10, y + 24], fill="#0f172a")
    d.rectangle([x + 7, y + 20, x + 9, y + l + 2], fill="#f97316") # Boom arm
    d.rectangle([x + 6, y + l + 1, x + 10, y + l + 3], fill="#94a3b8") # Tow crossbar

    # Amber Lightbar on cab roof
    d.rectangle([x + 2, y + 11, x + w - 2, y + 13], fill="#f59e0b")
    d.point((x + w // 2, y + 12), fill="#ffffff")

    # Headlights
    d.rectangle([x + 1, y, x + 3, y + 1], fill="#fef08a")
    d.rectangle([x + w - 3, y, x + w - 1, y + 1], fill="#fef08a")

    # Amber Beacon Flashes
    if siren_frame == 1:
        draw_light_flare(d, x + 3, y + 12, (245, 158, 11), size=4)
        draw_light_flare(d, x + w - 2, y + l - 2, (245, 158, 11), size=3)
    elif siren_frame == 2:
        draw_light_flare(d, x + w - 3, y + 12, (245, 158, 11), size=4)
        draw_light_flare(d, x + 2, y + l - 2, (245, 158, 11), size=3)

    suffix = f"_siren_{siren_frame}" if siren_frame > 0 else ""
    finalize(img, f"c:/Carlson/assets/vehicles/responder_tow_truck{suffix}.png")

if __name__ == "__main__":
    make_mechanic_shop()
    for f in [0, 1, 2]:
        make_tow_truck(f)
    print("Generated Mechanic Shop and Tow Truck sprites successfully!")
