from PIL import Image, ImageDraw

CANVAS_SIZE = 64
SCALE = 4  # produces 256x256 crisp pixel art

def create_sprite():
    return Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))

def finalize(img, path):
    scaled = img.resize((CANVAS_SIZE * SCALE, CANVAS_SIZE * SCALE), Image.Resampling.NEAREST)
    scaled.save(path, "PNG")
    print(f"Saved {path}")

# Helper: Draw glowing emergency light flare
def draw_light_flare(draw, cx, cy, color_rgb, size=4):
    r, g, b = color_rgb
    # Outer glow halo
    draw.ellipse([cx - size - 2, cy - size - 2, cx + size + 2, cy + size + 2], fill=(r, g, b, 70))
    # Mid glow
    draw.ellipse([cx - size, cy - size, cx + size, cy + size], fill=(r, g, b, 170))
    # White-hot center core
    draw.ellipse([cx - 1, cy - 1, cx + 1, cy + 1], fill=(255, 255, 255, 255))

# ==========================================
# 1. POLICE PATROL CRUISER (Base & Siren 1 & 2)
# ==========================================
def make_police_cruiser(siren_frame=0):
    img = create_sprite()
    d = ImageDraw.Draw(img)
    x, y, w, l = 25, 18, 14, 28

    # Shadow
    d.rectangle([x - 1, y + 2, x + w + 1, y + l + 1], fill=(0, 0, 0, 80))

    # Wheels
    d.rectangle([x - 2, y + 4, x, y + 9], fill="#18181b")
    d.rectangle([x + w, y + 4, x + w + 2, y + 9], fill="#18181b")
    d.rectangle([x - 2, y + l - 9, x, y + l - 4], fill="#18181b")
    d.rectangle([x + w, y + l - 9, x + w + 2, y + l - 4], fill="#18181b")

    # Black front & rear, white cab
    d.rectangle([x, y, x + w, y + l], fill="#0f172a")
    d.rectangle([x, y + 8, x + w, y + l - 8], fill="#f8fafc")

    # Push bumper on front
    d.rectangle([x + 2, y - 2, x + w - 2, y], fill="#334155")

    # Windshields
    d.rectangle([x + 2, y + 6, x + w - 2, y + 10], fill="#38bdf8")
    d.rectangle([x + 2, y + l - 9, x + w - 2, y + l - 6], fill="#38bdf8")

    # Roof with star
    d.rectangle([x + 2, y + 11, x + w - 2, y + l - 10], fill="#ffffff")
    d.point((x + w // 2, y + l // 2 + 1), fill="#eab308")

    # Headlights & Taillights
    hl_color = "#fef08a"
    if siren_frame == 1:
        # Alternating wig-wag headlights
        d.rectangle([x + 1, y, x + 3, y + 1], fill="#ffffff")
        d.rectangle([x + w - 3, y, x + w - 1, y + 1], fill="#71717a")
    elif siren_frame == 2:
        d.rectangle([x + 1, y, x + 3, y + 1], fill="#71717a")
        d.rectangle([x + w - 3, y, x + w - 1, y + 1], fill="#ffffff")
    else:
        d.rectangle([x + 1, y, x + 3, y + 1], fill=hl_color)
        d.rectangle([x + w - 3, y, x + w - 1, y + 1], fill=hl_color)

    d.rectangle([x + 1, y + l - 1, x + 3, y + l], fill="#ef4444")
    d.rectangle([x + w - 3, y + l - 1, x + w - 1, y + l], fill="#ef4444")

    # Siren Bar Base
    d.rectangle([x + 1, y + 12, x + 6, y + 14], fill="#ef4444" if siren_frame != 2 else "#7f1d1d")
    d.rectangle([x + 7, y + 12, x + 7, y + 14], fill="#ffffff")
    d.rectangle([x + 8, y + 12, x + 13, y + 14], fill="#3b82f6" if siren_frame != 1 else "#1e3a8a")

    # Flashing light bursts
    if siren_frame == 1:
        # Flash RED on left
        draw_light_flare(d, x + 3, y + 13, (239, 68, 68), size=4)
    elif siren_frame == 2:
        # Flash BLUE on right
        draw_light_flare(d, x + 10, y + 13, (59, 130, 246), size=4)

    suffix = f"_siren_{siren_frame}" if siren_frame > 0 else ""
    finalize(img, f"c:/Carlson/assets/vehicles/responder_police_cruiser{suffix}.png")

# ==========================================
# 2. FIRE ENGINE PUMPER (Base & Siren 1 & 2)
# ==========================================
def make_fire_engine(siren_frame=0):
    img = create_sprite()
    d = ImageDraw.Draw(img)
    x, y, w, l = 24, 12, 16, 40

    # Shadow
    d.rectangle([x - 1, y + 2, x + w + 1, y + l + 1], fill=(0, 0, 0, 80))

    # 6 Wheels
    d.rectangle([x - 2, y + 6, x, y + 11], fill="#18181b")
    d.rectangle([x + w, y + 6, x + w + 2, y + 11], fill="#18181b")
    d.rectangle([x - 2, y + 26, x, y + 31], fill="#18181b")
    d.rectangle([x + w, y + 26, x + w + 2, y + 31], fill="#18181b")
    d.rectangle([x - 2, y + 32, x, y + 37], fill="#18181b")
    d.rectangle([x + w, y + 32, x + w + 2, y + 37], fill="#18181b")

    # Red Body
    d.rectangle([x, y, x + w, y + l], fill="#b91c1c")
    d.rectangle([x + 1, y + 1, x + w - 1, y + l - 1], fill="#dc2626")

    # Windshield
    d.rectangle([x + 2, y + 6, x + w - 2, y + 11], fill="#bae6fd")

    # Ladder & Hose Bed
    d.rectangle([x + 2, y + 18, x + 6, y + 36], fill="#e2e8f0")
    for r in range(y + 20, y + 36, 3):
        d.line([x + 2, r, x + 6, r], fill="#64748b")
    d.rectangle([x + 8, y + 20, x + 14, y + 36], fill="#ca8a04")
    for hy in range(y + 22, y + 36, 4):
        d.line([x + 8, hy, x + 14, hy], fill="#a16207")

    # Chevron bumper
    for cx in range(x, x + w, 4):
        d.rectangle([cx, y + l - 2, min(cx + 1, x + w), y + l], fill="#facc15")
        d.rectangle([min(cx + 2, x + w), y + l - 2, min(cx + 3, x + w), y + l], fill="#000000")

    # Siren bar on cab
    d.rectangle([x + 2, y + 12, x + w - 2, y + 15], fill="#ef4444")
    d.point((x + w // 2, y + 13), fill="#ffffff")

    # Headlights
    d.rectangle([x + 1, y, x + 3, y + 1], fill="#ffffff")
    d.rectangle([x + w - 3, y, x + w - 1, y + 1], fill="#ffffff")

    # Emergency Flares
    if siren_frame == 1:
        # Huge red pulse on left cab & rear beacon
        draw_light_flare(d, x + 3, y + 13, (239, 68, 68), size=5)
        draw_light_flare(d, x + w - 2, y + l - 3, (245, 158, 11), size=3) # amber rear
    elif siren_frame == 2:
        # Huge red pulse on right cab & rear beacon
        draw_light_flare(d, x + w - 3, y + 13, (239, 68, 68), size=5)
        draw_light_flare(d, x + 2, y + l - 3, (245, 158, 11), size=3)

    suffix = f"_siren_{siren_frame}" if siren_frame > 0 else ""
    finalize(img, f"c:/Carlson/assets/vehicles/responder_fire_engine{suffix}.png")

# ==========================================
# 3. AMBULANCE (Base & Siren 1 & 2)
# ==========================================
def make_ambulance(siren_frame=0):
    img = create_sprite()
    d = ImageDraw.Draw(img)
    x, y, w, l = 24, 16, 16, 32

    # Shadow
    d.rectangle([x - 1, y + 2, x + w + 1, y + l + 1], fill=(0, 0, 0, 80))

    # Wheels
    d.rectangle([x - 2, y + 5, x, y + 10], fill="#18181b")
    d.rectangle([x + w, y + 5, x + w + 2, y + 10], fill="#18181b")
    d.rectangle([x - 2, y + l - 10, x, y + l - 5], fill="#18181b")
    d.rectangle([x + w, y + l - 10, x + w + 2, y + l - 5], fill="#18181b")

    # White Body
    d.rectangle([x, y, x + w, y + l], fill="#f8fafc")
    d.line([x + 1, y + 12, x + 1, y + l - 2], fill="#ea580c")
    d.line([x + w - 1, y + 12, x + w - 1, y + l - 2], fill="#ea580c")

    # Windshield & Roof Cross
    d.rectangle([x + 2, y + 5, x + w - 2, y + 9], fill="#38bdf8")
    d.rectangle([x + 5, y + 18, x + 11, y + 24], fill="#ef4444")
    d.rectangle([x + 7, y + 16, x + 9, y + 26], fill="#ef4444")

    # Siren bar
    d.rectangle([x + 2, y + 10, x + 6, y + 12], fill="#3b82f6")
    d.rectangle([x + 10, y + 10, x + 14, y + 12], fill="#ef4444")

    # Headlights & Rear
    d.rectangle([x + 1, y, x + 3, y + 1], fill="#fef08a")
    d.rectangle([x + w - 3, y, x + w - 1, y + 1], fill="#fef08a")
    d.line([x + w // 2, y + l - 4, x + w // 2, y + l], fill="#64748b")

    # Flashes
    if siren_frame == 1:
        draw_light_flare(d, x + 4, y + 11, (59, 130, 246), size=4) # Blue strobe
        draw_light_flare(d, x + w - 2, y + l - 2, (239, 68, 68), size=3) # rear red
    elif siren_frame == 2:
        draw_light_flare(d, x + 12, y + 11, (239, 68, 68), size=4) # Red strobe
        draw_light_flare(d, x + 2, y + l - 2, (59, 130, 246), size=3) # rear blue

    suffix = f"_siren_{siren_frame}" if siren_frame > 0 else ""
    finalize(img, f"c:/Carlson/assets/vehicles/responder_ambulance{suffix}.png")

# ==========================================
# 4. BATTALION CHIEF SUV (Base & Siren 1 & 2)
# ==========================================
def make_chief_suv(siren_frame=0):
    img = create_sprite()
    d = ImageDraw.Draw(img)
    x, y, w, l = 25, 18, 14, 28

    # Shadow & Wheels
    d.rectangle([x - 1, y + 2, x + w + 1, y + l + 1], fill=(0, 0, 0, 80))
    d.rectangle([x - 2, y + 4, x, y + 9], fill="#18181b")
    d.rectangle([x + w, y + 4, x + w + 2, y + 9], fill="#18181b")
    d.rectangle([x - 2, y + l - 9, x, y + l - 4], fill="#18181b")
    d.rectangle([x + w, y + l - 9, x + w + 2, y + l - 4], fill="#18181b")

    # Red body, white roof
    d.rectangle([x, y, x + w, y + l], fill="#b91c1c")
    d.rectangle([x + 2, y + 10, x + w - 2, y + l - 6], fill="#ffffff")
    d.rectangle([x + 4, y + 16, x + w - 4, y + 20], fill="#b91c1c")
    d.rectangle([x + 2, y + 6, x + w - 2, y + 9], fill="#bae6fd")

    d.rectangle([x + 2, y + 10, x + 6, y + 12], fill="#ef4444")
    d.rectangle([x + 8, y + 10, x + 12, y + 12], fill="#f59e0b")

    d.rectangle([x + 1, y, x + 3, y + 1], fill="#ffffff")
    d.rectangle([x + w - 3, y, x + w - 1, y + 1], fill="#ffffff")

    if siren_frame == 1:
        draw_light_flare(d, x + 4, y + 11, (239, 68, 68), size=4) # Red
    elif siren_frame == 2:
        draw_light_flare(d, x + 10, y + 11, (245, 158, 11), size=4) # Amber

    suffix = f"_siren_{siren_frame}" if siren_frame > 0 else ""
    finalize(img, f"c:/Carlson/assets/vehicles/responder_chief_suv{suffix}.png")

if __name__ == "__main__":
    for f in [0, 1, 2]:
        make_police_cruiser(f)
        make_fire_engine(f)
        make_ambulance(f)
        make_chief_suv(f)
    print("All responder siren animation frames generated successfully!")
