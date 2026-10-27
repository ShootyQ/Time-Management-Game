from PIL import Image, ImageDraw

CANVAS_SIZE = 64
SCALE = 4  # produces 256x256 crisp pixel art

def create_sprite():
    return Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))

def finalize(img, path):
    scaled = img.resize((CANVAS_SIZE * SCALE, CANVAS_SIZE * SCALE), Image.Resampling.NEAREST)
    scaled.save(path, "PNG")
    print(f"Saved {path}")

# Standard car dimensions on 64x64 canvas (facing North / UP)
# Body width ~14px, length ~26px (fits in 1 lane)
def draw_base_car(draw, x, y, w, l, body_color, roof_color=None, dark_accent="#111827"):
    if roof_color is None:
        roof_color = body_color

    # Shadow underneath
    draw.rectangle([x - 1, y + 2, x + w + 1, y + l + 1], fill=(0, 0, 0, 80))

    # Wheels (top-down black tires sticking out slightly)
    # Front-left, Front-right, Rear-left, Rear-right
    draw.rectangle([x - 2, y + 4, x, y + 9], fill="#18181b")
    draw.rectangle([x + w, y + 4, x + w + 2, y + 9], fill="#18181b")
    draw.rectangle([x - 2, y + l - 9, x, y + l - 4], fill="#18181b")
    draw.rectangle([x + w, y + l - 9, x + w + 2, y + l - 4], fill="#18181b")

    # Main Car Body
    draw.rectangle([x, y, x + w, y + l], fill=body_color)
    draw.rectangle([x + 1, y + 1, x + w - 1, y + l - 1], fill=body_color)

    # Windshield (front)
    draw.rectangle([x + 2, y + 6, x + w - 2, y + 10], fill="#38bdf8")
    # Rear window
    draw.rectangle([x + 2, y + l - 9, x + w - 2, y + l - 6], fill="#38bdf8")
    # Side glass
    draw.line([x + 1, y + 10, x + 1, y + l - 9], fill="#0284c7")
    draw.line([x + w - 1, y + 10, x + w - 1, y + l - 9], fill="#0284c7")

    # Roof
    draw.rectangle([x + 2, y + 11, x + w - 2, y + l - 10], fill=roof_color)

    # Headlights (bright white/yellow on front)
    draw.rectangle([x + 1, y, x + 3, y + 1], fill="#fef08a")
    draw.rectangle([x + w - 3, y, x + w - 1, y + 1], fill="#fef08a")

    # Taillights (red on rear)
    draw.rectangle([x + 1, y + l - 1, x + 3, y + l], fill="#ef4444")
    draw.rectangle([x + w - 3, y + l - 1, x + w - 1, y + l], fill="#ef4444")

# ==========================================
# 1. EMERGENCY RESPONDERS
# ==========================================

# Police Patrol Cruiser (Black & White with Red/Blue Lightbar)
def make_police_cruiser():
    img = create_sprite()
    d = ImageDraw.Draw(img)
    x, y, w, l = 25, 18, 14, 28

    # Wheels
    d.rectangle([x - 2, y + 4, x, y + 9], fill="#18181b")
    d.rectangle([x + w, y + 4, x + w + 2, y + 9], fill="#18181b")
    d.rectangle([x - 2, y + l - 9, x, y + l - 4], fill="#18181b")
    d.rectangle([x + w, y + l - 9, x + w + 2, y + l - 4], fill="#18181b")

    # Black front and rear, white roof & doors
    d.rectangle([x, y, x + w, y + l], fill="#0f172a") # black base
    d.rectangle([x, y + 8, x + w, y + l - 8], fill="#f8fafc") # white center cab

    # Push bumper on front
    d.rectangle([x + 2, y - 2, x + w - 2, y], fill="#334155")

    # Windshield & windows
    d.rectangle([x + 2, y + 6, x + w - 2, y + 10], fill="#38bdf8")
    d.rectangle([x + 2, y + l - 9, x + w - 2, y + l - 6], fill="#38bdf8")

    # Roof (white with gold star)
    d.rectangle([x + 2, y + 11, x + w - 2, y + l - 10], fill="#ffffff")
    d.point((x + w // 2, y + l // 2 + 1), fill="#eab308") # gold star

    # Red/Blue Flashing Lightbar on roof
    d.rectangle([x + 1, y + 12, x + 6, y + 14], fill="#ef4444") # Red siren
    d.rectangle([x + 7, y + 12, x + 7, y + 14], fill="#ffffff") # White strobe
    d.rectangle([x + 8, y + 12, x + 13, y + 14], fill="#3b82f6") # Blue siren

    # Lights
    d.rectangle([x + 1, y, x + 3, y + 1], fill="#fef08a")
    d.rectangle([x + w - 3, y, x + w - 1, y + 1], fill="#fef08a")
    d.rectangle([x + 1, y + l - 1, x + 3, y + l], fill="#ef4444")
    d.rectangle([x + w - 3, y + l - 1, x + w - 1, y + l], fill="#ef4444")

    finalize(img, "c:/Carlson/assets/vehicles/responder_police_cruiser.png")

# Heavy Fire Engine Pumper Truck (Long, Ladder, Water Hose Bed)
def make_fire_engine():
    img = create_sprite()
    d = ImageDraw.Draw(img)
    x, y, w, l = 24, 12, 16, 40

    # 6 Heavy Truck Wheels
    d.rectangle([x - 2, y + 6, x, y + 11], fill="#18181b")
    d.rectangle([x + w, y + 6, x + w + 2, y + 11], fill="#18181b")
    d.rectangle([x - 2, y + 26, x, y + 31], fill="#18181b")
    d.rectangle([x + w, y + 26, x + w + 2, y + 31], fill="#18181b")
    d.rectangle([x - 2, y + 32, x, y + 37], fill="#18181b")
    d.rectangle([x + w, y + 32, x + w + 2, y + 37], fill="#18181b")

    # Red Truck Body
    d.rectangle([x, y, x + w, y + l], fill="#b91c1c")
    d.rectangle([x + 1, y + 1, x + w - 1, y + l - 1], fill="#dc2626")

    # Front Cab Windshield
    d.rectangle([x + 2, y + 6, x + w - 2, y + 11], fill="#bae6fd")

    # Dual Red/White Emergency Siren Bar
    d.rectangle([x + 2, y + 12, x + w - 2, y + 15], fill="#ef4444")
    d.point((x + w // 2, y + 13), fill="#ffffff")

    # Silver Extension Ladder on Roof
    d.rectangle([x + 2, y + 18, x + 6, y + 36], fill="#e2e8f0")
    for r in range(y + 20, y + 36, 3):
        d.line([x + 2, r, x + 6, r], fill="#64748b")

    # Hose Bed (Yellow/Green canvas rolled hoses)
    d.rectangle([x + 8, y + 20, x + 14, y + 36], fill="#ca8a04")
    for hy in range(y + 22, y + 36, 4):
        d.line([x + 8, hy, x + 14, hy], fill="#a16207")

    # Yellow & Black Chevron Warning Stripes on Rear Bumper
    for cx in range(x, x + w, 4):
        d.rectangle([cx, y + l - 2, min(cx + 1, x + w), y + l], fill="#facc15")
        d.rectangle([min(cx + 2, x + w), y + l - 2, min(cx + 3, x + w), y + l], fill="#000000")

    # Headlights
    d.rectangle([x + 1, y, x + 3, y + 1], fill="#ffffff")
    d.rectangle([x + w - 3, y, x + w - 1, y + 1], fill="#ffffff")

    finalize(img, "c:/Carlson/assets/vehicles/responder_fire_engine.png")

# Paramedic Ambulance (White/Orange with Red Cross)
def make_ambulance():
    img = create_sprite()
    d = ImageDraw.Draw(img)
    x, y, w, l = 24, 16, 16, 32

    # Wheels
    d.rectangle([x - 2, y + 5, x, y + 10], fill="#18181b")
    d.rectangle([x + w, y + 5, x + w + 2, y + 10], fill="#18181b")
    d.rectangle([x - 2, y + l - 10, x, y + l - 5], fill="#18181b")
    d.rectangle([x + w, y + l - 10, x + w + 2, y + l - 5], fill="#18181b")

    # White Ambulance Van Body
    d.rectangle([x, y, x + w, y + l], fill="#f8fafc")
    # High-vis orange/red side stripe
    d.line([x + 1, y + 12, x + 1, y + l - 2], fill="#ea580c")
    d.line([x + w - 1, y + 12, x + w - 1, y + l - 2], fill="#ea580c")

    # Windshield
    d.rectangle([x + 2, y + 5, x + w - 2, y + 9], fill="#38bdf8")

    # Roof Red Cross Emblem
    d.rectangle([x + 5, y + 18, x + 11, y + 24], fill="#ef4444")
    d.rectangle([x + 7, y + 16, x + 9, y + 26], fill="#ef4444")

    # Blue/Red Emergency Lightbars
    d.rectangle([x + 2, y + 10, x + 6, y + 12], fill="#3b82f6") # Blue
    d.rectangle([x + 10, y + 10, x + 14, y + 12], fill="#ef4444") # Red

    # Rear Paramedic Doors
    d.line([x + w // 2, y + l - 4, x + w // 2, y + l], fill="#64748b")
    d.rectangle([x + 1, y + l - 1, x + 3, y + l], fill="#ef4444")
    d.rectangle([x + w - 3, y + l - 1, x + w - 1, y + l], fill="#ef4444")

    # Headlights
    d.rectangle([x + 1, y, x + 3, y + 1], fill="#fef08a")
    d.rectangle([x + w - 3, y, x + w - 1, y + 1], fill="#fef08a")

    finalize(img, "c:/Carlson/assets/vehicles/responder_ambulance.png")

# Battalion Chief Command SUV
def make_chief_suv():
    img = create_sprite()
    d = ImageDraw.Draw(img)
    x, y, w, l = 25, 18, 14, 28

    # Wheels
    d.rectangle([x - 2, y + 4, x, y + 9], fill="#18181b")
    d.rectangle([x + w, y + 4, x + w + 2, y + 9], fill="#18181b")
    d.rectangle([x - 2, y + l - 9, x, y + l - 4], fill="#18181b")
    d.rectangle([x + w, y + l - 9, x + w + 2, y + l - 4], fill="#18181b")

    # Fire Red SUV Body
    d.rectangle([x, y, x + w, y + l], fill="#b91c1c")
    # White roof with "CHIEF" designation stripe
    d.rectangle([x + 2, y + 10, x + w - 2, y + l - 6], fill="#ffffff")
    d.rectangle([x + 4, y + 16, x + w - 4, y + 20], fill="#b91c1c")

    # Windshield
    d.rectangle([x + 2, y + 6, x + w - 2, y + 9], fill="#bae6fd")

    # Red/Amber Roof Lightbar
    d.rectangle([x + 2, y + 10, x + 6, y + 12], fill="#ef4444")
    d.rectangle([x + 8, y + 10, x + 12, y + 12], fill="#f59e0b")

    # Headlights & Taillights
    d.rectangle([x + 1, y, x + 3, y + 1], fill="#ffffff")
    d.rectangle([x + w - 3, y, x + w - 1, y + 1], fill="#ffffff")
    d.rectangle([x + 1, y + l - 1, x + 3, y + l], fill="#ef4444")
    d.rectangle([x + w - 3, y + l - 1, x + w - 1, y + l], fill="#ef4444")

    finalize(img, "c:/Carlson/assets/vehicles/responder_chief_suv.png")

# ==========================================
# 2. CIVILIAN FLEET (14 Types & Colors)
# ==========================================

def make_civilians():
    civilians = [
        ("car_sedan_blue", "#2563eb", "#1d4ed8"),
        ("car_sedan_red", "#dc2626", "#b91c1c"),
        ("car_sedan_silver", "#94a3b8", "#cbd5e1"),
        ("car_compact_green", "#16a34a", "#22c55e"),
        ("car_compact_orange", "#ea580c", "#f97316"),
        ("car_suv_dark", "#334155", "#1e293b"),
        ("car_station_wagon", "#78350f", "#b45309"),
        ("car_sports_coupe", "#eab308", "#ca8a04"),
    ]

    for name, body, roof in civilians:
        img = create_sprite()
        d = ImageDraw.Draw(img)
        draw_base_car(d, 25, 20, 14, 26, body, roof)
        finalize(img, f"c:/Carlson/assets/vehicles/{name}.png")

    # Special Civilian: Yellow Taxi Cab
    img = create_sprite()
    d = ImageDraw.Draw(img)
    draw_base_car(d, 25, 20, 14, 26, "#facc15", "#eab308")
    # Taxi Rooftop Sign
    d.rectangle([29, 31, 35, 33], fill="#ffffff")
    d.point((32, 32), fill="#000000")
    finalize(img, "c:/Carlson/assets/vehicles/car_taxi_yellow.png")

    # Special Civilian: White Pickup Truck
    img = create_sprite()
    d = ImageDraw.Draw(img)
    x, y, w, l = 25, 18, 14, 28
    # Wheels
    d.rectangle([x - 2, y + 4, x, y + 9], fill="#18181b")
    d.rectangle([x + w, y + 4, x + w + 2, y + 9], fill="#18181b")
    d.rectangle([x - 2, y + l - 9, x, y + l - 4], fill="#18181b")
    d.rectangle([x + w, y + l - 9, x + w + 2, y + l - 4], fill="#18181b")
    d.rectangle([x, y, x + w, y + l], fill="#f8fafc") # white body
    d.rectangle([x + 2, y + 6, x + w - 2, y + 10], fill="#38bdf8") # windshield
    d.rectangle([x + 2, y + 10, x + w - 2, y + 16], fill="#ffffff") # cab roof
    # Open truck cargo bed
    d.rectangle([x + 2, y + 18, x + w - 2, y + l - 2], fill="#475569")
    finalize(img, "c:/Carlson/assets/vehicles/car_pickup_white.png")

    # Special Civilian: Delivery Box Van
    img = create_sprite()
    d = ImageDraw.Draw(img)
    x, y, w, l = 24, 16, 16, 32
    # Wheels
    d.rectangle([x - 2, y + 5, x, y + 10], fill="#18181b")
    d.rectangle([x + w, y + 5, x + w + 2, y + 10], fill="#18181b")
    d.rectangle([x - 2, y + l - 10, x, y + l - 5], fill="#18181b")
    d.rectangle([x + w, y + l - 10, x + w + 2, y + l - 5], fill="#18181b")
    d.rectangle([x, y, x + w, y + 12], fill="#e2e8f0") # front cab
    d.rectangle([x + 2, y + 5, x + w - 2, y + 9], fill="#38bdf8") # windshield
    # Rear Cargo Box (White with parcel logo stripe)
    d.rectangle([x - 1, y + 12, x + w + 1, y + l], fill="#ffffff")
    d.rectangle([x, y + 20, x + w, y + 23], fill="#3b82f6") # blue corporate stripe
    # Rear door seam
    d.line([x + w // 2, y + l - 2, x + w // 2, y + l], fill="#94a3b8")
    finalize(img, "c:/Carlson/assets/vehicles/car_van_delivery.png")

    # Special Civilian: Green Sanitation Garbage Truck
    img = create_sprite()
    d = ImageDraw.Draw(img)
    x, y, w, l = 23, 14, 18, 36
    # 6 wheels
    d.rectangle([x - 2, y + 6, x, y + 11], fill="#18181b")
    d.rectangle([x + w, y + 6, x + w + 2, y + 11], fill="#18181b")
    d.rectangle([x - 2, y + 22, x, y + 27], fill="#18181b")
    d.rectangle([x + w, y + 22, x + w + 2, y + 27], fill="#18181b")
    d.rectangle([x - 2, y + 28, x, y + 33], fill="#18181b")
    d.rectangle([x + w, y + 28, x + w + 2, y + 33], fill="#18181b")
    # Green Cab
    d.rectangle([x, y, x + w, y + 12], fill="#15803d")
    d.rectangle([x + 2, y + 5, x + w - 2, y + 9], fill="#bae6fd")
    # Heavy Compactor Body
    d.rectangle([x - 1, y + 13, x + w + 1, y + l - 4], fill="#166534")
    # Rear hopper
    d.rectangle([x + 1, y + l - 4, x + w - 1, y + l], fill="#374151")
    finalize(img, "c:/Carlson/assets/vehicles/car_garbage_truck.png")

    # Special Civilian: Yellow School Bus
    img = create_sprite()
    d = ImageDraw.Draw(img)
    x, y, w, l = 24, 10, 16, 44
    # 6 wheels
    d.rectangle([x - 2, y + 8, x, y + 13], fill="#18181b")
    d.rectangle([x + w, y + 8, x + w + 2, y + 13], fill="#18181b")
    d.rectangle([x - 2, y + 30, x, y + 35], fill="#18181b")
    d.rectangle([x + w, y + 30, x + w + 2, y + 35], fill="#18181b")
    d.rectangle([x - 2, y + 36, x, y + 41], fill="#18181b")
    d.rectangle([x + w, y + 36, x + w + 2, y + 41], fill="#18181b")
    # Long School Bus Yellow Body
    d.rectangle([x, y, x + w, y + l], fill="#eab308")
    d.rectangle([x + 2, y + 6, x + w - 2, y + 10], fill="#38bdf8") # windshield
    # Black safety stripes down sides
    d.line([x + 1, y + 12, x + 1, y + l - 2], fill="#000000")
    d.line([x + w - 1, y + 12, x + w - 1, y + l - 2], fill="#000000")
    # White roof emergency hatch
    d.rectangle([x + 5, y + 20, x + 11, y + 26], fill="#ffffff")
    d.rectangle([x + 5, y + 32, x + 11, y + 38], fill="#ffffff")
    finalize(img, "c:/Carlson/assets/vehicles/car_school_bus.png")

if __name__ == "__main__":
    make_police_cruiser()
    make_fire_engine()
    make_ambulance()
    make_chief_suv()
    make_civilians()
    print("All vehicle fleet sprites generated!")
