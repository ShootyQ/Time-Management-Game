from PIL import Image, ImageDraw

TILE_SIZE = 96
SCALE = 4

def create_sprite():
    return Image.new("RGBA", (TILE_SIZE, TILE_SIZE), (0, 0, 0, 0))

def finalize(img, path):
    scaled = img.resize((TILE_SIZE * SCALE, TILE_SIZE * SCALE), Image.Resampling.NEAREST)
    scaled.save(path, "PNG")
    print(f"Saved {path}")

def draw_window(draw, x, y, w, h, glass="#93c5fd", frame="#1e293b", shine=True):
    draw.rectangle([x, y, x + w, y + h], fill=frame)
    draw.rectangle([x + 1, y + 1, x + w - 1, y + h - 1], fill=glass)
    if shine and w > 3 and h > 3:
        draw.line([x + 2, y + 2, x + w - 2, y + 2], fill="#e0f2fe")

def draw_pitched_roof(draw, x_start, x_end, y_base, height, color="#334155", trim="#1e293b"):
    for step in range(height):
        dx = step * ((x_end - x_start) // (height * 2))
        draw.line([x_start + dx, y_base - step, x_end - dx, y_base - step], fill=color)
    draw.line([x_start, y_base, x_end, y_base], fill=trim)

# 1. Blue Suburban Family Home
def make_house_01():
    img = create_sprite()
    d = ImageDraw.Draw(img)
    # Yard & Path
    d.rectangle([14, 66, 82, 92], fill="#15803d") # green lawn
    for y in range(68, 92, 4):
        d.rectangle([44, y, 52, y + 2], fill="#94a3b8") # stone path
    # House body
    d.rectangle([18, 30, 78, 68], fill="#38bdf8") # sky blue lap siding
    for sy in range(32, 68, 4):
        d.line([18, sy, 78, sy], fill="#0284c7")
    # Roof
    draw_pitched_roof(d, 14, 82, 30, 14, color="#1e293b", trim="#0f172a")
    # Chimney
    d.rectangle([64, 10, 72, 24], fill="#991b1b")
    # Windows & Door
    draw_window(d, 24, 40, 10, 12)
    draw_window(d, 62, 40, 10, 12)
    d.rectangle([43, 44, 53, 68], fill="#78350f") # wood door
    d.point((45, 56), fill="#fbbf24") # brass knob
    finalize(img, "c:/Carlson/assets/residential/house_01_blue_suburban.png")

# 2. Classic Red Brick Ranch
def make_house_02():
    img = create_sprite()
    d = ImageDraw.Draw(img)
    # Concrete driveway on right
    d.rectangle([66, 60, 86, 94], fill="#64748b")
    # Brick body
    d.rectangle([12, 32, 66, 70], fill="#991b1b")
    for by in range(34, 70, 3):
        offset = 2 if (by // 3) % 2 == 0 else 0
        for bx in range(12 + offset, 66, 4):
            d.point((bx, by), fill="#b91c1c")
    # Low-pitch roof
    draw_pitched_roof(d, 10, 68, 32, 10, color="#451a03", trim="#290f02")
    # Garage bay on right
    d.rectangle([66, 38, 86, 70], fill="#475569")
    for gy in range(40, 70, 4):
        d.line([68, gy, 84, gy], fill="#94a3b8")
    # Windows & Door
    draw_window(d, 18, 44, 12, 10, frame="#ffffff")
    draw_window(d, 36, 44, 12, 10, frame="#ffffff")
    d.rectangle([52, 46, 60, 70], fill="#ffffff")
    d.point((54, 58), fill="#000000")
    finalize(img, "c:/Carlson/assets/residential/house_02_brick_ranch.png")

# 3. Terracotta Spanish Cottage
def make_house_03():
    img = create_sprite()
    d = ImageDraw.Draw(img)
    # Stucco walls
    d.rectangle([18, 32, 78, 72], fill="#fef3c7") # warm cream stucco
    # Terracotta curved tile roof
    for step in range(12):
        d.line([16 + step * 2, 32 - step, 80 - step * 2, 32 - step], fill="#ea580c")
    d.line([16, 32, 80, 32], fill="#9a3412")
    # Arched wooden door
    d.rectangle([42, 46, 54, 72], fill="#78350f")
    d.arc([42, 40, 54, 52], 180, 360, fill="#78350f")
    d.point((44, 58), fill="#f59e0b")
    # Windows with flower boxes
    draw_window(d, 24, 42, 10, 10, frame="#78350f")
    d.rectangle([22, 53, 36, 56], fill="#e11d48") # flower box
    draw_window(d, 62, 42, 10, 10, frame="#78350f")
    d.rectangle([60, 53, 74, 56], fill="#e11d48")
    finalize(img, "c:/Carlson/assets/residential/house_03_terracotta_cottage.png")

# 4. Modern Minimalist Cube House
def make_house_04():
    img = create_sprite()
    d = ImageDraw.Draw(img)
    # Clean lawn & slate patio
    d.rectangle([12, 68, 84, 94], fill="#15803d")
    d.rectangle([48, 68, 80, 88], fill="#334155") # dark slate patio
    # Geometric White Cubic Frame
    d.rectangle([16, 18, 54, 68], fill="#f8fafc") # white cube
    d.rectangle([16, 14, 54, 18], fill="#0f172a") # dark roof cap
    # Cedar wood accent wing
    d.rectangle([54, 28, 82, 68], fill="#d97706") # cedar wood
    for wy in range(30, 68, 4):
        d.line([54, wy, 82, wy], fill="#92400e")
    # Floor-to-ceiling glass window
    d.rectangle([22, 28, 46, 58], fill="#0284c7")
    d.rectangle([24, 30, 44, 56], fill="#7dd3fc")
    d.line([34, 28, 34, 58], fill="#0f172a")
    # Sleek black pivot door
    d.rectangle([58, 44, 68, 68], fill="#0f172a")
    d.line([66, 48, 66, 62], fill="#e2e8f0") # vertical chrome bar
    finalize(img, "c:/Carlson/assets/residential/house_04_modern_minimal.png")

# 5. Cozy Craftsman Bungalow
def make_house_05():
    img = create_sprite()
    d = ImageDraw.Draw(img)
    # Riverstone base
    d.rectangle([16, 56, 80, 72], fill="#64748b")
    # Sage green siding
    d.rectangle([18, 28, 78, 56], fill="#84cc16")
    for sy in range(30, 56, 3):
        d.line([18, sy, 78, sy], fill="#4d7c0f")
    # Low-pitched overhanging craftsman roof
    draw_pitched_roof(d, 12, 84, 28, 12, color="#78350f", trim="#451a03")
    # Covered front porch with tapered pillars
    d.rectangle([26, 46, 70, 72], fill="#451a03")
    d.rectangle([28, 48, 68, 72], fill="#fef3c7")
    d.rectangle([26, 48, 30, 72], fill="#78350f") # left pillar
    d.rectangle([66, 48, 70, 72], fill="#78350f") # right pillar
    # Craftsman windows with multi-pane tops
    draw_window(d, 34, 34, 8, 8, frame="#451a03")
    draw_window(d, 54, 34, 8, 8, frame="#451a03")
    # Door
    d.rectangle([44, 52, 52, 72], fill="#78350f")
    finalize(img, "c:/Carlson/assets/residential/house_05_craftsman_bungalow.png")

# 6. Two-Story Victorian Manor
def make_house_06():
    img = create_sprite()
    d = ImageDraw.Draw(img)
    # Lavender / pastel siding
    d.rectangle([14, 22, 82, 72], fill="#e9d5ff")
    # Steep gabled roofs
    draw_pitched_roof(d, 12, 54, 22, 14, color="#581c87", trim="#3b0764")
    # Right-side Octagonal Turret Tower
    d.rectangle([54, 10, 84, 72], fill="#d8b4fe")
    for st in range(8):
        d.line([54 + st * 2, 10 - st, 84 - st * 2, 10 - st], fill="#3b0764")
    # Gingerbread decorative trim
    for tx in range(14, 54, 4):
        d.point((tx, 24), fill="#ffffff")
    # Turret bay windows
    draw_window(d, 60, 18, 6, 8, frame="#ffffff")
    draw_window(d, 70, 18, 6, 8, frame="#ffffff")
    draw_window(d, 62, 38, 14, 10, frame="#ffffff")
    # Main house windows
    draw_window(d, 22, 30, 10, 10, frame="#ffffff")
    draw_window(d, 38, 30, 10, 10, frame="#ffffff")
    # Victorian Double Door
    d.rectangle([28, 50, 42, 72], fill="#581c87")
    d.rectangle([30, 52, 34, 62], fill="#fef08a")
    d.rectangle([36, 52, 40, 62], fill="#fef08a")
    finalize(img, "c:/Carlson/assets/residential/house_06_victorian_manor.png")

# 7. Yellow Colonial Home
def make_house_07():
    img = create_sprite()
    d = ImageDraw.Draw(img)
    # Yellow clapboard body
    d.rectangle([16, 26, 80, 72], fill="#fef08a")
    for cy in range(28, 72, 4):
        d.line([16, cy, 80, cy], fill="#eab308")
    # Black roof with dual dormer windows
    draw_pitched_roof(d, 12, 84, 26, 12, color="#1e293b", trim="#0f172a")
    # Dormers
    d.rectangle([26, 16, 36, 26], fill="#fef08a")
    draw_window(d, 28, 18, 6, 6, frame="#1e293b")
    d.rectangle([60, 16, 70, 26], fill="#fef08a")
    draw_window(d, 62, 18, 6, 6, frame="#1e293b")
    # Dark green shutters on windows
    for wx in [22, 64]:
        d.rectangle([wx - 2, 36, wx + 10, 48], fill="#14532d") # green shutter
        draw_window(d, wx, 36, 8, 12, frame="#ffffff")
    # Centered Red Door with Fanlight
    d.rectangle([43, 48, 53, 72], fill="#b91c1c")
    d.arc([43, 42, 53, 50], 180, 360, fill="#ffffff") # fanlight
    d.point((45, 60), fill="#fbbf24")
    finalize(img, "c:/Carlson/assets/residential/house_07_yellow_colonial.png")

# 8. Urban Brick Townhome Duplex
def make_house_08():
    img = create_sprite()
    d = ImageDraw.Draw(img)
    # Two-unit brick townhome
    d.rectangle([14, 18, 82, 72], fill="#831843") # deep wine brick
    d.rectangle([14, 14, 82, 18], fill="#374151") # roof cornice
    # Dividing party wall line down center
    d.line([48, 14, 48, 72], fill="#500724")
    # Upper windows (Unit A and Unit B)
    draw_window(d, 20, 26, 8, 10, frame="#ffffff")
    draw_window(d, 34, 26, 8, 10, frame="#ffffff")
    draw_window(d, 54, 26, 8, 10, frame="#ffffff")
    draw_window(d, 68, 26, 8, 10, frame="#ffffff")
    # Lower windows
    draw_window(d, 20, 46, 8, 12, frame="#ffffff")
    draw_window(d, 68, 46, 8, 12, frame="#ffffff")
    # Dual front stoops with iron railings
    d.rectangle([32, 52, 40, 72], fill="#1e293b") # door A
    d.rectangle([56, 52, 64, 72], fill="#1e293b") # door B
    # Front stoop stairs
    d.rectangle([30, 64, 42, 78], fill="#94a3b8")
    d.rectangle([54, 64, 66, 78], fill="#94a3b8")
    finalize(img, "c:/Carlson/assets/residential/house_08_brick_townhome.png")

# 9. Rustic Log Cabin
def make_house_09():
    img = create_sprite()
    d = ImageDraw.Draw(img)
    # Forest grass & stone hearth
    d.rectangle([14, 66, 82, 94], fill="#14532d") # dark forest grass
    # Stacked timber logs
    d.rectangle([16, 32, 80, 70], fill="#78350f")
    for ly in range(34, 70, 5):
        d.line([16, ly, 80, ly], fill="#451a03")
        d.ellipse([14, ly - 2, 18, ly + 2], fill="#92400e") # log end
        d.ellipse([78, ly - 2, 82, ly + 2], fill="#92400e")
    # Forest Green Roof
    draw_pitched_roof(d, 12, 84, 32, 12, color="#166534", trim="#052e16")
    # Stone Chimney
    d.rectangle([22, 12, 30, 28], fill="#71717a")
    d.point((25, 18), fill="#a1a1aa")
    # Small warm windows & wooden door
    draw_window(d, 36, 42, 8, 8, glass="#fef08a", frame="#451a03")
    draw_window(d, 60, 42, 8, 8, glass="#fef08a", frame="#451a03")
    d.rectangle([46, 48, 54, 70], fill="#451a03")
    # Porch firewood stack
    d.rectangle([68, 58, 76, 68], fill="#b45309")
    finalize(img, "c:/Carlson/assets/residential/house_09_log_cabin.png")

# 10. Multi-Story Urban Apartment Block
def make_house_10():
    img = create_sprite()
    d = ImageDraw.Draw(img)
    # 3-Story Brick Apartment
    d.rectangle([14, 12, 82, 74], fill="#b45309") # rust brick
    d.rectangle([12, 8, 84, 12], fill="#451a03")  # parapet roof
    # Rooftop antenna & access door
    d.rectangle([20, 4, 30, 8], fill="#1e293b")
    d.line([64, 0, 64, 8], fill="#94a3b8")
    d.line([61, 3, 67, 3], fill="#94a3b8")
    # 3 Floors of Windows
    for floor_y in [18, 36, 54]:
        draw_window(d, 22, floor_y, 8, 10, frame="#1e293b")
        draw_window(d, 44, floor_y, 8, 10, frame="#1e293b")
    # Fire escape ladder on right side
    d.line([68, 14, 68, 68], fill="#1e293b")
    d.line([78, 14, 78, 68], fill="#1e293b")
    for fy in range(16, 68, 6):
        d.line([68, fy, 78, fy], fill="#1e293b")
    # Entrance awning & double glass doors
    d.rectangle([38, 58, 58, 62], fill="#15803d") # green awning
    d.rectangle([40, 62, 56, 74], fill="#0f172a")
    d.rectangle([42, 64, 54, 74], fill="#93c5fd")
    finalize(img, "c:/Carlson/assets/residential/house_10_apartment.png")

if __name__ == "__main__":
    make_house_01()
    make_house_02()
    make_house_03()
    make_house_04()
    make_house_05()
    make_house_06()
    make_house_07()
    make_house_08()
    make_house_09()
    make_house_10()
    print("All 10 residential houses generated successfully!")
