from PIL import Image, ImageDraw

TILE_SIZE = 96  # base pixel grid size
SCALE = 4       # scale up factor (produces 384x384 ultra-crisp pixel art)

def create_sprite():
    return Image.new("RGBA", (TILE_SIZE, TILE_SIZE), (0, 0, 0, 0))

def finalize(img, path):
    # Nearest neighbor upscale for razor-sharp pixel art
    scaled = img.resize((TILE_SIZE * SCALE, TILE_SIZE * SCALE), Image.Resampling.NEAREST)
    scaled.save(path, "PNG")
    print(f"Saved {path}")

# --- Helper drawing functions ---
def draw_windows(draw, x_coords, y, w, h, glass="#78bfe0", frame="#242930"):
    for x in x_coords:
        draw.rectangle([x, y, x + w, y + h], fill=frame)
        draw.rectangle([x + 1, y + 1, x + w - 1, y + h - 1], fill=glass)
        # Highlight shine
        draw.line([x + 2, y + 2, x + w - 3, y + 2], fill="#bce4f7")

def draw_bay_door(draw, x, y, w, h, door_color="#a83232", slat_color="#7a1f1f"):
    draw.rectangle([x, y, x + w, y + h], fill="#2e3138") # outer frame
    draw.rectangle([x + 1, y + 1, x + w - 1, y + h], fill=door_color)
    # horizontal roll-up slats
    for sy in range(y + 3, y + h, 4):
        draw.line([x + 1, sy, x + w - 1, sy], fill=slat_color)
    # Yellow/black caution hazard border at bottom
    for cx in range(x + 1, x + w, 4):
        draw.rectangle([cx, y + h - 2, min(cx + 1, x + w - 1), y + h], fill="#ffd000")
        draw.rectangle([min(cx + 2, x + w - 1), y + h - 2, min(cx + 3, x + w - 1), y + h], fill="#222222")

# ==========================================
# 1. FIRE STATION 1: Classic Brick Firehouse
# ==========================================
def make_fire_station_1():
    img = create_sprite()
    d = ImageDraw.Draw(img)

    # Concrete driveway apron
    d.rectangle([10, 68, 86, 94], fill="#4f535c")
    d.line([10, 94, 86, 94], fill="#383a40")

    # Main brick building body
    d.rectangle([14, 20, 82, 70], fill="#8c2f2d") # brick red
    # Brick mortar texture
    for by in range(22, 68, 3):
        offset = 2 if (by // 3) % 2 == 0 else 0
        for bx in range(14 + offset, 82, 5):
            d.point((bx, by), fill="#b34947")
            d.point((bx + 1, by + 1), fill="#6e2220")

    # Pitched dark shingle roof
    for step in range(8):
        d.line([12 + step, 20 - step, 84 - step, 20 - step], fill="#2a2e36")
    d.line([12, 20, 84, 20], fill="#1c1e24") # roof trim

    # Station Bell / Siren on peak
    d.rectangle([46, 7, 50, 12], fill="#e6b830") # bell
    d.line([48, 5, 48, 7], fill="#888888")
    d.rectangle([54, 8, 58, 12], fill="#cc2222") # red emergency beacon

    # Upper floor windows
    draw_windows(d, [20, 34, 58, 72], 26, 6, 8)

    # Gold "FIRE DEPT" crest plaque
    d.rectangle([44, 24, 52, 34], fill="#d49b28")
    d.rectangle([45, 25, 51, 33], fill="#fae06b")
    d.point((48, 29), fill="#a82828") # center emblem

    # Dual Roll-Up Fire Engine Bays
    draw_bay_door(d, 18, 44, 26, 26, door_color="#a82828", slat_color="#731919")
    draw_bay_door(d, 52, 44, 26, 26, door_color="#a82828", slat_color="#731919")

    finalize(img, "c:/Carlson/assets/stations/fire_station_1.png")

# ==========================================
# 2. FIRE STATION 2: Modern Municipal Station
# ==========================================
def make_fire_station_2():
    img = create_sprite()
    d = ImageDraw.Draw(img)

    # Modern smooth concrete base
    d.rectangle([8, 66, 88, 94], fill="#5b606b")

    # Left main building (Offices + Tower)
    d.rectangle([10, 14, 38, 68], fill="#d2d7df") # light concrete
    # Red accent stripe
    d.rectangle([10, 28, 38, 32], fill="#c72626")

    # Communications Tower (antenna)
    d.line([24, 2, 24, 14], fill="#8a929e")
    d.line([20, 6, 28, 6], fill="#8a929e")
    d.point((24, 1), fill="#ff2222") # flashing red beacon

    # Modern ribbon windows
    draw_windows(d, [14, 26], 20, 8, 5, glass="#4f9bb8", frame="#1d2024")
    draw_windows(d, [14, 26], 38, 8, 8, glass="#4f9bb8", frame="#1d2024")

    # Right 2 Large Heavy Bays
    d.rectangle([38, 32, 86, 68], fill="#383d47") # dark grey hangar
    d.rectangle([38, 28, 86, 32], fill="#c72626") # red trim roof
    draw_bay_door(d, 42, 36, 20, 32, door_color="#c72626", slat_color="#8c1616")
    draw_bay_door(d, 64, 36, 20, 32, door_color="#c72626", slat_color="#8c1616")

    finalize(img, "c:/Carlson/assets/stations/fire_station_2.png")

# ==========================================
# 3. POLICE STATION 1: Urban Police Precinct
# ==========================================
def make_police_station_1():
    img = create_sprite()
    d = ImageDraw.Draw(img)

    # Paved parking & entrance walkway
    d.rectangle([12, 70, 84, 94], fill="#444852")
    # Blue cruiser parking lines
    d.line([18, 76, 36, 76], fill="#3b78c4")
    d.line([18, 88, 36, 88], fill="#3b78c4")

    # Stone/brick facade
    d.rectangle([14, 22, 82, 72], fill="#4a5261") # slate blue-grey
    d.rectangle([14, 18, 82, 22], fill="#1e2430") # heavy cornice roof

    # Iconic Police Blue Stripe
    d.rectangle([14, 34, 82, 38], fill="#2563eb")

    # Gold Police Shield Emblem
    d.rectangle([44, 24, 52, 32], fill="#eab308")
    d.point((48, 28), fill="#1e3a8a")

    # Radio & Dispatch Mast
    d.line([74, 6, 74, 18], fill="#94a3b8")
    d.line([71, 9, 77, 9], fill="#94a3b8")
    d.point((74, 5), fill="#38bdf8")

    # Windows with security bars
    for x in [20, 30, 66, 76]:
        d.rectangle([x, 44, x + 6, 52], fill="#1e293b")
        d.rectangle([x + 1, 45, x + 5, 51], fill="#60a5fa")
        d.line([x + 3, 44, x + 3, 52], fill="#1e293b") # vertical bar

    # Heavy double glass entrance with blue emergency light
    d.rectangle([43, 50, 53, 72], fill="#0f172a")
    d.rectangle([45, 54, 51, 72], fill="#93c5fd")
    d.rectangle([46, 46, 50, 49], fill="#2563eb") # blue light above door

    finalize(img, "c:/Carlson/assets/stations/police_station_1.png")

# ==========================================
# 4. POLICE STATION 2: Sheriff Substation
# ==========================================
def make_police_station_2():
    img = create_sprite()
    d = ImageDraw.Draw(img)

    # Concrete driveway
    d.rectangle([10, 68, 86, 94], fill="#6b7280")

    # Tan sandstone brick building
    d.rectangle([14, 28, 62, 70], fill="#b89c74") # tan stone
    d.rectangle([14, 24, 62, 28], fill="#59442e") # dark wood trim

    # Flagpole
    d.line([18, 6, 18, 28], fill="#cbd5e1")
    d.rectangle([19, 7, 26, 12], fill="#ef4444")
    d.rectangle([19, 7, 22, 10], fill="#3b82f6")

    # Gold 7-point star badge
    d.rectangle([36, 32, 42, 38], fill="#f59e0b")
    d.point((39, 35), fill="#78350f")

    # Windows
    draw_windows(d, [22, 50], 44, 8, 8, glass="#93c5fd", frame="#451a03")

    # Entrance door
    d.rectangle([34, 48, 44, 70], fill="#451a03")
    d.rectangle([36, 52, 42, 62], fill="#bae6fd")

    # Right side vehicle covered carport
    d.rectangle([62, 36, 84, 40], fill="#374151") # canopy roof
    d.line([82, 40, 82, 70], fill="#4b5563") # support post
    d.line([64, 40, 64, 70], fill="#4b5563")

    finalize(img, "c:/Carlson/assets/stations/police_station_2.png")

# ==========================================
# 5. HOSPITAL 1: County General Hospital
# ==========================================
def make_hospital_1():
    img = create_sprite()
    d = ImageDraw.Draw(img)

    # Ambulance intake ramp & parking
    d.rectangle([8, 68, 88, 94], fill="#475569")
    # Red cross emergency intake lines
    d.rectangle([14, 78, 38, 92], fill="#dc2626")
    d.rectangle([16, 80, 36, 90], fill="#ffffff")
    d.line([26, 82, 26, 88], fill="#dc2626")
    d.line([23, 85, 29, 85], fill="#dc2626")

    # Multi-story clean white/grey hospital building
    d.rectangle([12, 18, 84, 70], fill="#e2e8f0") # medical white
    d.rectangle([12, 14, 84, 18], fill="#0284c7") # blue roofline

    # Rooftop Helipad
    d.rectangle([46, 6, 78, 14], fill="#334155")
    d.ellipse([54, 7, 70, 13], outline="#ffffff")
    d.line([60, 8, 60, 12], fill="#ffffff") # H mark
    d.line([64, 8, 64, 12], fill="#ffffff")
    d.line([60, 10, 64, 10], fill="#ffffff")

    # Huge Red Cross Emblem
    d.rectangle([20, 24, 36, 40], fill="#ffffff") # white circle/shield base
    d.rectangle([26, 26, 30, 38], fill="#ef4444") # vertical red arm
    d.rectangle([22, 30, 34, 34], fill="#ef4444") # horizontal red arm

    # Hospital ribbon windows
    draw_windows(d, [44, 56, 68], 24, 8, 6, glass="#38bdf8", frame="#0f172a")
    draw_windows(d, [44, 56, 68], 34, 8, 6, glass="#38bdf8", frame="#0f172a")

    # Emergency Ambulance intake bay with illuminated sign
    d.rectangle([16, 48, 48, 52], fill="#ef4444") # "EMERGENCY" banner
    d.rectangle([18, 52, 46, 70], fill="#0f172a") # dark ambulance bay
    d.rectangle([54, 52, 76, 70], fill="#1e293b") # glass lobby doors
    d.rectangle([56, 54, 74, 70], fill="#bae6fd")

    finalize(img, "c:/Carlson/assets/stations/hospital_1.png")

# ==========================================
# 6. HOSPITAL 2: Community Medical Clinic
# ==========================================
def make_hospital_2():
    img = create_sprite()
    d = ImageDraw.Draw(img)

    # Drop-off driveway
    d.rectangle([12, 68, 84, 94], fill="#64748b")

    # Modern clinic building
    d.rectangle([16, 26, 80, 70], fill="#f1f5f9")
    d.rectangle([16, 22, 80, 26], fill="#10b981") # green health trim

    # Green Cross Emblem
    d.rectangle([22, 32, 34, 44], fill="#ffffff")
    d.rectangle([26, 34, 30, 42], fill="#10b981") # green vertical
    d.rectangle([24, 36, 32, 40], fill="#10b981") # green horizontal

    # Glass entrance & intake bay
    d.rectangle([42, 38, 74, 70], fill="#0284c7")
    d.rectangle([44, 40, 72, 70], fill="#7dd3fc")

    # Solar panels on flat roof
    for px in [24, 40, 56]:
        d.rectangle([px, 16, px + 12, 22], fill="#1e3a8a")
        d.line([px + 6, 16, px + 6, 22], fill="#60a5fa")

    finalize(img, "c:/Carlson/assets/stations/hospital_2.png")

if __name__ == "__main__":
    make_fire_station_1()
    make_fire_station_2()
    make_police_station_1()
    make_police_station_2()
    make_hospital_1()
    make_hospital_2()
    print("All 6 emergency stations successfully generated!")
