from PIL import Image, ImageDraw

TILE_SIZE = 96
SCALE = 4

def create_sprite():
    return Image.new("RGBA", (TILE_SIZE, TILE_SIZE), (0, 0, 0, 0))

def finalize(img, path):
    scaled = img.resize((TILE_SIZE * SCALE, TILE_SIZE * SCALE), Image.Resampling.NEAREST)
    scaled.save(path, "PNG")
    print(f"Saved {path}")

def draw_windows(draw, x_coords, y, w, h, glass="#60a5fa", frame="#1e293b"):
    for x in x_coords:
        draw.rectangle([x, y, x + w, y + h], fill=frame)
        draw.rectangle([x + 1, y + 1, x + w - 1, y + h - 1], fill=glass)
        draw.line([x + 2, y + 2, x + w - 3, y + 2], fill="#bae6fd")

# ==========================================
# 1. GAS STATION: Pumps + Convenience Store
# ==========================================
def make_gas_station():
    img = create_sprite()
    d = ImageDraw.Draw(img)

    # Asphalt forecourt
    d.rectangle([6, 20, 90, 94], fill="#3e424b")

    # Mini-Mart Building (back)
    d.rectangle([14, 12, 82, 42], fill="#f3f4f6") # light building
    d.rectangle([14, 8, 82, 12], fill="#dc2626")  # red roofline
    # "SHOP" glass storefront
    d.rectangle([22, 22, 54, 40], fill="#0284c7")
    d.rectangle([24, 24, 52, 40], fill="#7dd3fc")
    # Store Door
    d.rectangle([58, 22, 70, 42], fill="#1e293b")
    d.rectangle([60, 24, 68, 42], fill="#bae6fd")
    # Gas Price Sign
    d.rectangle([74, 16, 80, 28], fill="#15803d")
    d.point((76, 19), fill="#ffffff")

    # Fuel Canopy (front)
    d.rectangle([10, 48, 86, 56], fill="#e11d48") # bright red canopy roof
    d.rectangle([12, 56, 84, 58], fill="#9f1239")
    # Canopy Support Pillars
    d.rectangle([18, 58, 22, 86], fill="#94a3b8")
    d.rectangle([74, 58, 78, 86], fill="#94a3b8")

    # Fuel Pump Islands (2 islands with red & blue pumps)
    for px in [30, 56]:
        d.rectangle([px, 68, px + 10, 84], fill="#cbd5e1") # concrete island
        d.rectangle([px + 2, 64, px + 8, 80], fill="#ef4444") # pump body
        d.rectangle([px + 3, 67, px + 7, 72], fill="#1e293b") # digital meter
        d.line([px + 8, 70, px + 8, 78], fill="#000000")      # nozzle hose

    finalize(img, "c:/Carlson/assets/commercial/gas_station.png")

# ==========================================
# 2. 24/7 DINER: Retro Chrome & Neon Diner
# ==========================================
def make_diner():
    img = create_sprite()
    d = ImageDraw.Draw(img)

    # Outdoor pavement & checkered patio
    d.rectangle([10, 68, 86, 94], fill="#4b5563")

    # Metallic / Retro turquoise body
    d.rectangle([12, 26, 84, 70], fill="#0d9488") # teal body
    d.rectangle([12, 20, 84, 26], fill="#e2e8f0") # polished chrome roof band

    # Red/White Neon "DINER" sign on roof
    d.rectangle([32, 10, 64, 20], fill="#b91c1c")
    d.rectangle([34, 12, 62, 18], fill="#f87171")
    # Neon glow outline
    d.line([30, 9, 66, 9], fill="#fca5a5")

    # Striped sun awning over front
    for ax in range(16, 80, 8):
        d.rectangle([ax, 34, ax + 4, 40], fill="#ef4444") # red
        d.rectangle([ax + 4, 34, ax + 8, 40], fill="#ffffff") # white

    # Classic panoramic diner windows
    draw_windows(d, [16, 30, 58, 72], 44, 10, 12, glass="#a5f3fc", frame="#334155")

    # Entrance door with stainless steel handle
    d.rectangle([44, 44, 52, 70], fill="#64748b")
    d.rectangle([46, 46, 50, 60], fill="#e0f2fe")
    d.point((45, 58), fill="#e2e8f0") # chrome knob

    # Rooftop grease exhaust vents
    d.rectangle([18, 14, 24, 20], fill="#64748b")
    d.ellipse([19, 13, 23, 16], fill="#94a3b8")

    finalize(img, "c:/Carlson/assets/commercial/diner.png")

# ==========================================
# 3. CIVIC SCHOOL: Elementary School & Clock
# ==========================================
def make_school():
    img = create_sprite()
    d = ImageDraw.Draw(img)

    # School Crosswalk (Yellow pedestrian stripes on street)
    d.rectangle([8, 76, 88, 94], fill="#334155")
    for zx in range(12, 84, 8):
        d.rectangle([zx, 80, zx + 4, 90], fill="#facc15") # yellow crosswalk zebra

    # Red brick school wings
    d.rectangle([10, 30, 86, 76], fill="#991b1b") # red brick
    d.rectangle([10, 26, 86, 30], fill="#450a0a") # dark roof trim

    # Central Clock & Bell Tower
    d.rectangle([36, 8, 60, 30], fill="#7f1d1d")
    # Slanted roof peak on tower
    for st in range(6):
        d.line([36 + st * 2, 8 - st, 60 - st * 2, 8 - st], fill="#450a0a")

    # The Clock Face
    d.ellipse([42, 12, 54, 24], fill="#ffffff", outline="#1e293b")
    d.line([48, 18, 48, 14], fill="#000000") # 12:00
    d.line([48, 18, 51, 18], fill="#dc2626") # 8:15 bell time!

    # Classroom windows
    draw_windows(d, [14, 24, 68, 78], 38, 6, 10, glass="#93c5fd", frame="#1e293b")
    draw_windows(d, [14, 24, 68, 78], 54, 6, 10, glass="#93c5fd", frame="#1e293b")

    # Double Wooden School Entrance Doors
    d.rectangle([42, 48, 54, 76], fill="#78350f")
    d.rectangle([44, 52, 47, 64], fill="#fef08a") # window
    d.rectangle([49, 52, 52, 64], fill="#fef08a")

    # American Flag outside
    d.line([28, 14, 28, 30], fill="#cbd5e1")
    d.rectangle([29, 15, 34, 19], fill="#ef4444")
    d.rectangle([29, 15, 31, 17], fill="#1d4ed8")

    finalize(img, "c:/Carlson/assets/commercial/school.png")

# ==========================================
# 4. SUPERMARKET: Grocery Store & Delivery Bay
# ==========================================
def make_supermarket():
    img = create_sprite()
    d = ImageDraw.Draw(img)

    # Parking lot / front apron
    d.rectangle([6, 70, 90, 94], fill="#475569")
    # White parking bay lines
    d.line([14, 78, 28, 78], fill="#ffffff")
    d.line([14, 88, 28, 88], fill="#ffffff")

    # Wide commercial building
    d.rectangle([8, 22, 88, 72], fill="#e2e8f0") # clean white
    d.rectangle([8, 16, 88, 22], fill="#15803d")  # green brand roof

    # "SUPERMARKET" illuminated green sign
    d.rectangle([24, 10, 72, 18], fill="#16a34a")
    d.line([26, 14, 70, 14], fill="#bbf7d0")

    # Automatic Sliding Glass Entrance
    d.rectangle([34, 44, 62, 72], fill="#0284c7")
    d.rectangle([36, 46, 60, 72], fill="#bae6fd")
    d.line([48, 44, 48, 72], fill="#0f172a") # sliding split

    # Shopping Cart Corral
    d.rectangle([14, 56, 26, 70], fill="#94a3b8")
    d.rectangle([16, 58, 24, 68], fill="#475569")
    for cy in range(60, 68, 3):
        d.line([16, cy, 24, cy], fill="#cbd5e1") # carts

    # Delivery Truck Bay on right side
    d.rectangle([70, 46, 84, 72], fill="#1e293b")
    for ry in range(48, 72, 4):
        d.line([72, ry, 82, ry], fill="#64748b") # shutter roll-up

    # Rooftop HVAC air conditioners
    d.rectangle([20, 12, 30, 16], fill="#64748b")
    d.rectangle([66, 12, 76, 16], fill="#64748b")

    finalize(img, "c:/Carlson/assets/commercial/supermarket.png")

# ==========================================
# 5. BANK: First National Bank
# ==========================================
def make_bank():
    img = create_sprite()
    d = ImageDraw.Draw(img)

    # Stone Plaza
    d.rectangle([10, 70, 86, 94], fill="#6b7280")

    # Stately Limestone Neoclassical Building
    d.rectangle([12, 24, 84, 72], fill="#cbd5e1") # grey limestone

    # Classical Triangular Pediment Roof
    for pt in range(12):
        d.line([12 + pt * 3, 24 - pt, 84 - pt * 3, 24 - pt], fill="#94a3b8")
    d.line([12, 24, 84, 24], fill="#475569")

    # Gold "BANK" emblem
    d.rectangle([42, 17, 54, 22], fill="#d97706")
    d.point((48, 19), fill="#fef08a")

    # Classical Stone Columns
    for col_x in [18, 32, 58, 72]:
        d.rectangle([col_x, 26, col_x + 6, 70], fill="#f1f5f9")
        d.line([col_x, 26, col_x, 70], fill="#94a3b8") # column shadow
        d.line([col_x + 5, 26, col_x + 5, 70], fill="#ffffff") # highlight

    # Heavy Bronze Double Doors
    d.rectangle([42, 42, 54, 70], fill="#78350f")
    d.line([48, 42, 48, 70], fill="#451a03")
    d.point((45, 56), fill="#fbbf24") # gold handles
    d.point((51, 56), fill="#fbbf24")

    # Drive-thru ATM on right
    d.rectangle([74, 52, 82, 66], fill="#0284c7")
    d.rectangle([76, 54, 80, 60], fill="#38bdf8") # ATM screen

    finalize(img, "c:/Carlson/assets/commercial/bank.png")

# ==========================================
# 6. INDUSTRIAL: Chemical Warehouse / Factory
# ==========================================
def make_industrial_warehouse():
    img = create_sprite()
    d = ImageDraw.Draw(img)

    # Stained industrial concrete ground
    d.rectangle([8, 64, 88, 94], fill="#3f3f46")
    # Oil/chemical stain
    d.ellipse([14, 72, 32, 84], fill="#27272a")

    # Corrugated Steel Warehouse Body
    d.rectangle([12, 26, 84, 68], fill="#52525b") # dark zinc/steel
    # Vertical corrugated sheet lines
    for cx in range(14, 84, 4):
        d.line([cx, 26, cx, 68], fill="#71717a")

    # Heavy Steel Roof with Exhaust Pipes
    d.rectangle([10, 22, 86, 26], fill="#27272a")
    # Twin Smokestacks
    d.rectangle([20, 8, 26, 22], fill="#a1a1aa")
    d.rectangle([30, 10, 36, 22], fill="#a1a1aa")
    # Warning red/white bands on smokestacks
    d.line([20, 12, 26, 12], fill="#ef4444")
    d.line([30, 14, 36, 14], fill="#ef4444")

    # Chemical Hazard Warning Diamond on Wall (Yellow/Black)
    d.polygon([(48, 30), (54, 36), (48, 42), (42, 36)], fill="#eab308")
    d.point((48, 36), fill="#000000") # hazard symbol

    # Heavy Cargo Loading Bay
    d.rectangle([54, 42, 80, 68], fill="#18181b")
    # Metal roll-up shutter
    for sy in range(44, 68, 3):
        d.line([56, sy, 78, sy], fill="#71717a")
    # Yellow/black hazard tape on dock edge
    for hx in range(54, 80, 4):
        d.rectangle([hx, 66, min(hx + 1, 79), 68], fill="#eab308")
        d.rectangle([min(hx + 2, 79), 66, min(hx + 3, 79), 68], fill="#000000")

    # Heavy Reinforced Personnel Door
    d.rectangle([20, 46, 32, 68], fill="#27272a")
    d.rectangle([22, 48, 30, 56], fill="#fbbf24") # caution window

    finalize(img, "c:/Carlson/assets/commercial/industrial_warehouse.png")

if __name__ == "__main__":
    make_gas_station()
    make_diner()
    make_school()
    make_supermarket()
    make_bank()
    make_industrial_warehouse()
    print("All 6 commercial & civic hazard buildings generated!")
