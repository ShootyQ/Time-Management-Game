import os
from PIL import Image, ImageDraw

OUT_DIR = r"c:\Carlson\assets\fx"
os.makedirs(OUT_DIR, exist_ok=True)


def make_fire_frame(frame_idx):
    """32x32 16-bit pixel art roaring structure fire + smoke."""
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Dark smoke puffs at top
    smoke_offsets = [
        [(10, 4, 6), (18, 3, 5), (14, 7, 6)],
        [(12, 3, 6), (20, 5, 5), (9, 6, 5)],
        [(8, 4, 5), (16, 2, 6), (21, 6, 5)],
    ][frame_idx % 3]

    for sx, sy, sr in smoke_offsets:
        d.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=(30, 41, 59, 210))
        d.ellipse([sx - sr + 2, sy - sr + 1, sx + sr - 1, sy + sr - 2], fill=(71, 85, 105, 220))

    # Outer dark red/crimson flame silhouette
    tongues = [
        [(6, 28), (5, 18), (10, 11), (13, 16), (16, 7), (20, 15), (24, 10), (27, 19), (26, 28)],
        [(6, 28), (4, 16), (9, 13), (14, 8), (17, 14), (21, 6), (25, 14), (28, 20), (26, 28)],
        [(6, 28), (6, 19), (11, 9), (15, 15), (18, 6), (22, 13), (26, 11), (27, 18), (26, 28)],
    ][frame_idx % 3]
    d.polygon(tongues, fill=(185, 28, 28, 255), outline=(69, 10, 10, 255))

    # Mid orange flame core
    mid_tongues = [
        [(8, 28), (8, 20), (12, 14), (16, 10), (20, 16), (23, 13), (24, 28)],
        [(8, 28), (7, 19), (13, 12), (17, 16), (21, 10), (24, 18), (24, 28)],
        [(8, 28), (9, 20), (12, 12), (16, 16), (19, 9), (23, 16), (24, 28)],
    ][frame_idx % 3]
    d.polygon(mid_tongues, fill=(249, 115, 22, 255))

    # Inner bright yellow-white hot core
    inner_tongues = [
        [(11, 28), (12, 19), (16, 14), (20, 20), (21, 28)],
        [(11, 28), (13, 17), (17, 20), (20, 15), (21, 28)],
        [(11, 28), (12, 18), (16, 13), (19, 19), (21, 28)],
    ][frame_idx % 3]
    d.polygon(inner_tongues, fill=(254, 240, 138, 255))

    # Flying sparks / embers
    sparks = [
        [(7, 10), (25, 7), (15, 4)],
        [(9, 7), (23, 4), (27, 11)],
        [(6, 8), (19, 3), (26, 9)],
    ][frame_idx % 3]
    for ex, ey in sparks:
        d.rectangle([ex, ey, ex + 1, ey + 1], fill=(253, 224, 71, 255))

    return img


def make_police_frame(frame_idx):
    """32x32 16-bit pixel art Police Crime Scene / Standoff badge + barrier tape & strobe."""
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Alternating Red / Blue strobe halo
    if frame_idx % 2 == 0:
        d.ellipse([2, 2, 16, 16], fill=(239, 68, 68, 175), outline=(254, 202, 202, 240))
        d.ellipse([16, 2, 30, 16], fill=(30, 58, 138, 130))
    else:
        d.ellipse([2, 2, 16, 16], fill=(127, 29, 29, 130))
        d.ellipse([16, 2, 30, 16], fill=(59, 130, 246, 185), outline=(191, 219, 254, 240))

    # Gold & Blue Police Shield in center
    shield = [(16, 4), (25, 8), (23, 19), (16, 25), (9, 19), (7, 8)]
    d.polygon(shield, fill=(30, 64, 175, 255), outline=(250, 204, 21, 255))
    inner_shield = [(16, 7), (22, 10), (20, 18), (16, 22), (12, 18), (10, 10)]
    d.polygon(inner_shield, fill=(29, 78, 216, 255))
    # Gold star center
    d.rectangle([15, 11, 17, 17], fill=(250, 204, 21, 255))
    d.rectangle([13, 13, 19, 15], fill=(250, 204, 21, 255))

    # Yellow & Black Crime Scene Police Tape across bottom
    d.rectangle([1, 24, 30, 29], fill=(250, 204, 21, 255), outline=(15, 23, 42, 255))
    offset = (frame_idx * 3) % 6
    for x in range(-4 + offset, 30, 6):
        poly = [(max(2, x), 25), (min(29, x + 3), 25), (min(29, x + 1), 28), (max(2, x - 2), 28)]
        d.polygon(poly, fill=(15, 23, 42, 255))

    return img


def make_medical_frame(frame_idx):
    """32x32 16-bit pixel art Medical Emergency Red Cross + ECG Heartbeat Pulse."""
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Outer pulsing ring
    pad = 2 if frame_idx % 2 == 0 else 4
    d.ellipse([pad, pad, 32 - pad, 32 - pad], fill=(15, 23, 42, 210), outline=(16, 185, 129, 255))

    # Crisp White & Red Paramedic Cross
    d.rectangle([12, 6, 20, 26], fill=(239, 68, 68, 255), outline=(255, 255, 255, 255))
    d.rectangle([6, 12, 26, 20], fill=(239, 68, 68, 255), outline=(255, 255, 255, 255))
    d.rectangle([13, 7, 19, 25], fill=(220, 38, 38, 255))
    d.rectangle([7, 13, 25, 19], fill=(220, 38, 38, 255))

    # Bright Green ECG Heartbeat line across center
    ecg_points = [(4, 16), (10, 16), (13, 10), (16, 23), (19, 12), (22, 16), (28, 16)]
    d.line(ecg_points, fill=(167, 243, 208, 255), width=2)

    return img


def make_hazmat_frame(frame_idx):
    """32x32 16-bit pixel art Chemical / Biohazard Toxic Cloud."""
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Bubbling toxic green/yellow cloud puffs
    puffs = [
        [(10, 18, 7), (21, 17, 7), (16, 11, 8)],
        [(9, 16, 7), (22, 18, 7), (15, 10, 8)],
    ][frame_idx % 2]
    for px, py, pr in puffs:
        d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=(132, 204, 22, 210), outline=(21, 128, 61, 255))

    # Hazard triangle in center
    tri = [(16, 8), (25, 24), (7, 24)]
    d.polygon(tri, fill=(250, 204, 21, 255), outline=(15, 23, 42, 255))
    d.rectangle([15, 13, 17, 18], fill=(15, 23, 42, 255))
    d.rectangle([15, 20, 17, 22], fill=(15, 23, 42, 255))

    return img


if __name__ == "__main__":
    for i in range(3):
        make_fire_frame(i).save(os.path.join(OUT_DIR, f"fx_fire_{i+1}.png"))
    for i in range(2):
        make_police_frame(i).save(os.path.join(OUT_DIR, f"fx_police_{i+1}.png"))
        make_medical_frame(i).save(os.path.join(OUT_DIR, f"fx_medical_{i+1}.png"))
        make_hazmat_frame(i).save(os.path.join(OUT_DIR, f"fx_hazmat_{i+1}.png"))
    print("Generated all 16-bit FX sprites in assets/fx/")
