#!/usr/bin/env python3
from __future__ import annotations

import argparse
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "assets" / "github-social-preview.png"

WIDTH = 1280
HEIGHT = 640

Color = tuple[int, int, int]

FONT_5X7 = {
    " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
    "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
    "/": ["00001", "00010", "00100", "01000", "10000", "00000", "00000"],
    ":": ["00000", "00100", "00100", "00000", "00100", "00100", "00000"],
    ">": ["10000", "01000", "00100", "00010", "00100", "01000", "10000"],
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
    "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    "C": ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    "G": ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
    "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    "I": ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
    "J": ["00001", "00001", "00001", "00001", "10001", "10001", "01110"],
    "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "N": ["10001", "10001", "11001", "10101", "10011", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "Q": ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    "W": ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
    "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    "Z": ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
}


class Canvas:
    def __init__(self, width: int, height: int, background: Color) -> None:
        self.width = width
        self.height = height
        self.pixels = bytearray(background * (width * height))

    def set_pixel(self, x: int, y: int, color: Color) -> None:
        if 0 <= x < self.width and 0 <= y < self.height:
            index = (y * self.width + x) * 3
            self.pixels[index:index + 3] = bytes(color)

    def fill_rect(self, x: int, y: int, w: int, h: int, color: Color) -> None:
        x0 = max(0, x)
        y0 = max(0, y)
        x1 = min(self.width, x + w)
        y1 = min(self.height, y + h)
        if x0 >= x1 or y0 >= y1:
            return
        row = bytes(color) * (x1 - x0)
        for py in range(y0, y1):
            start = (py * self.width + x0) * 3
            end = start + len(row)
            self.pixels[start:end] = row

    def fill_round_rect(self, x: int, y: int, w: int, h: int, r: int, color: Color) -> None:
        for py in range(y, y + h):
            for px in range(x, x + w):
                dx = 0
                dy = 0
                if px < x + r:
                    dx = x + r - px
                elif px >= x + w - r:
                    dx = px - (x + w - r - 1)
                if py < y + r:
                    dy = y + r - py
                elif py >= y + h - r:
                    dy = py - (y + h - r - 1)
                if dx == 0 or dy == 0 or dx * dx + dy * dy <= r * r:
                    self.set_pixel(px, py, color)

    def draw_grid(self, step: int, color: Color) -> None:
        for x in range(0, self.width, step):
            self.fill_rect(x, 0, 1, self.height, color)
        for y in range(0, self.height, step):
            self.fill_rect(0, y, self.width, 1, color)

    def draw_hline(self, x: int, y: int, w: int, thickness: int, color: Color) -> None:
        self.fill_rect(x, y, w, thickness, color)

    def draw_vline(self, x: int, y: int, h: int, thickness: int, color: Color) -> None:
        self.fill_rect(x, y, thickness, h, color)

    def fill_circle(self, cx: int, cy: int, radius: int, color: Color) -> None:
        r2 = radius * radius
        for y in range(cy - radius, cy + radius + 1):
            for x in range(cx - radius, cx + radius + 1):
                dx = x - cx
                dy = y - cy
                if dx * dx + dy * dy <= r2:
                    self.set_pixel(x, y, color)

    def blend_gradient(self, top_left: Color, top_right: Color, bottom_left: Color, bottom_right: Color) -> None:
        for y in range(self.height):
            fy = y / max(1, self.height - 1)
            left = tuple(int(top_left[i] * (1 - fy) + bottom_left[i] * fy) for i in range(3))
            right = tuple(int(top_right[i] * (1 - fy) + bottom_right[i] * fy) for i in range(3))
            for x in range(self.width):
                fx = x / max(1, self.width - 1)
                color = tuple(int(left[i] * (1 - fx) + right[i] * fx) for i in range(3))
                self.set_pixel(x, y, color)

    def draw_text(self, x: int, y: int, text: str, scale: int, color: Color, spacing: int = 1) -> None:
        cursor = x
        for char in text.upper():
            glyph = FONT_5X7.get(char, FONT_5X7[" "])
            for gy, row in enumerate(glyph):
                for gx, pixel in enumerate(row):
                    if pixel == "1":
                        self.fill_rect(cursor + gx * scale, y + gy * scale, scale, scale, color)
            cursor += (5 + spacing) * scale

    def draw_badge(self, x: int, y: int, w: int, h: int, color: Color, text: str, text_color: Color) -> None:
        self.fill_round_rect(x, y, w, h, 14, color)
        self.draw_text(x + 14, y + 14, text, 3, text_color)

    def save_png(self, path: Path) -> None:
        def chunk(tag: bytes, data: bytes) -> bytes:
            return (
                struct.pack("!I", len(data))
                + tag
                + data
                + struct.pack("!I", zlib.crc32(tag + data) & 0xFFFFFFFF)
            )

        raw = bytearray()
        stride = self.width * 3
        for y in range(self.height):
            raw.append(0)
            start = y * stride
            raw.extend(self.pixels[start:start + stride])

        png = bytearray(b"\x89PNG\r\n\x1a\n")
        png.extend(chunk(b"IHDR", struct.pack("!IIBBBBB", self.width, self.height, 8, 2, 0, 0, 0)))
        png.extend(chunk(b"IDAT", zlib.compress(bytes(raw), level=9)))
        png.extend(chunk(b"IEND", b""))
        path.write_bytes(png)


def build_image(output: Path) -> None:
    canvas = Canvas(WIDTH, HEIGHT, (245, 240, 230))
    canvas.blend_gradient(
        (244, 239, 226),
        (215, 228, 235),
        (231, 239, 226),
        (242, 233, 214),
    )
    canvas.draw_grid(32, (215, 222, 223))
    canvas.fill_circle(1090, 110, 150, (243, 201, 105))
    canvas.fill_circle(1090, 110, 144, (241, 233, 203))
    canvas.fill_circle(160, 582, 168, (214, 226, 229))
    canvas.fill_round_rect(52, 42, 1176, 556, 28, (252, 249, 241))
    canvas.fill_round_rect(84, 76, 492, 488, 28, (18, 39, 60))
    canvas.draw_badge(118, 108, 214, 52, (255, 138, 91), "LOCAL TRUST", (255, 248, 240))

    canvas.draw_text(120, 196, "OH-MY AGENT", 8, (252, 249, 241))
    canvas.draw_text(120, 270, "COMPANY", 8, (252, 249, 241))
    canvas.draw_text(120, 336, "CLIENT DELIVERY", 4, (204, 221, 232))
    canvas.draw_text(120, 372, "ORCHESTRATION", 4, (204, 221, 232))
    canvas.draw_text(120, 432, "APPROVAL GATES", 3, (243, 201, 105))
    canvas.draw_text(120, 460, "AUDIT-FIRST FLOW", 3, (243, 201, 105))

    pill_specs = [
        (120, 504, 126, 38, (252, 249, 241), "PM", (18, 39, 60)),
        (256, 504, 126, 38, (31, 77, 107), "CTO", (252, 249, 241)),
        (392, 504, 152, 38, (243, 201, 105), "DEV", (18, 39, 60)),
    ]
    for x, y, w, h, fill, label, text in pill_specs:
        canvas.fill_round_rect(x, y, w, h, 14, fill)
        canvas.draw_text(x + 18, y + 11, label, 3, text)

    canvas.fill_round_rect(620, 76, 560, 190, 24, (255, 255, 255))
    canvas.draw_text(652, 110, "PIPELINE SNAPSHOT", 4, (18, 39, 60))

    stage_cards = [
        (652, 158, 90, 70, (232, 241, 236), "INTAKE"),
        (760, 158, 78, 70, (255, 242, 214), "PM"),
        (856, 158, 84, 70, (231, 238, 251), "CTO"),
        (958, 158, 84, 70, (255, 229, 220), "DEV"),
        (1060, 158, 86, 70, (233, 241, 236), "QA"),
    ]
    for x, y, w, h, fill, label in stage_cards:
        canvas.fill_round_rect(x, y, w, h, 16, fill)
        canvas.draw_text(x + 12, y + 24, label, 2, (18, 39, 60))
    canvas.draw_hline(742, 191, 18, 4, (18, 39, 60))
    canvas.draw_hline(838, 191, 18, 4, (18, 39, 60))
    canvas.draw_hline(940, 191, 18, 4, (18, 39, 60))
    canvas.draw_hline(1042, 191, 18, 4, (18, 39, 60))

    canvas.fill_round_rect(620, 286, 560, 278, 24, (21, 48, 74))
    canvas.draw_text(652, 320, "RELEASE GATES", 4, (252, 249, 241))

    gate_rows = [
        ((255, 138, 91), "DESIGN REVIEW", "REQUIRED FOR UI COPY THEME"),
        ((243, 201, 105), "QA VERDICT", "PASS BLOCK OR WAIVE WITH EVIDENCE"),
        ((92, 168, 122), "POST JOB AUDIT", "RELEASE ONLY AFTER AUDIT EVENT"),
    ]
    row_y = 364
    for color, title, desc in gate_rows:
        canvas.fill_circle(676, row_y + 10, 14, color)
        canvas.draw_text(704, row_y, title, 3, (252, 249, 241))
        canvas.draw_text(704, row_y + 28, desc, 2, (197, 214, 223))
        row_y += 72

    canvas.fill_round_rect(84, 584, 1096, 28, 14, (228, 235, 227))
    bar_specs = [
        (98, 590, 188, 16, (18, 39, 60)),
        (304, 590, 224, 16, (31, 77, 107)),
        (546, 590, 282, 16, (255, 138, 91)),
        (846, 590, 206, 16, (243, 201, 105)),
    ]
    for x, y, w, h, fill in bar_specs:
        canvas.fill_round_rect(x, y, w, h, 8, fill)

    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save_png(output)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate GitHub social preview image.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    build_image(args.output)
    print(f"generated:{args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
