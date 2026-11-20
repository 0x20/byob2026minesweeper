"""Generate docs/architecture.svg: the gallery deployment diagram.

Standard library only. Run from anywhere:

    python docs/architecture.py
"""

from html import escape
from pathlib import Path

OUT = Path(__file__).with_name("architecture.svg")

W, H = 960, 600
INK = "#111"
MUTED = "#666"
FONT = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"

# Google brand colours, used only for the cloud mark.
G_RED, G_BLUE, G_GREEN, G_YELLOW = "#EA4335", "#4285F4", "#34A853", "#FBBC05"


def text(x, y, s, size=13, anchor="start", weight="normal", fill=INK):
    return (f'<text x="{x}" y="{y}" font-size="{size}" text-anchor="{anchor}" '
            f'font-weight="{weight}" fill="{fill}">{escape(s)}</text>')


def box(x, y, w, h, dashed=False, stroke_width=2):
    dash = ' stroke-dasharray="6 5"' if dashed else ""
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#fff" '
            f'stroke="{INK}" stroke-width="{stroke_width}"{dash}/>')


def arrow(x1, y1, x2, y2, dashed=False):
    dash = ' stroke-dasharray="6 5"' if dashed else ""
    return (f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{INK}" '
            f'stroke-width="2"{dash} marker-end="url(#head)"/>')


def line(x1, y1, x2, y2):
    return (f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{INK}" '
            f'stroke-width="2"/>')


def google_cloud_icon(x, y, scale=1.0):
    """Four-colour cloud outline, drawn in a 64 x 60 box."""
    arcs = [
        (G_YELLOW, "M 18 40 A 10 10 0 0 1 18 20"),   # left lobe
        (G_RED, "M 18 20 A 14 14 0 0 1 46 20"),      # top
        (G_BLUE, "M 46 20 A 10 10 0 0 1 46 40"),     # right lobe
        (G_GREEN, "M 46 40 L 18 40"),                # base
    ]
    paths = "".join(
        f'<path d="{d}" fill="none" stroke="{colour}" stroke-width="6" '
        f'stroke-linecap="round"/>'
        for colour, d in arcs
    )
    return f'<g transform="translate({x} {y}) scale({scale})">{paths}</g>'


def build():
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
        f'width="{W}" height="{H}" font-family="{FONT}">',
        '<defs><marker id="head" viewBox="0 0 10 10" refX="9" refY="5" '
        'markerWidth="8" markerHeight="8" orient="auto-start-reverse">'
        f'<path d="M 0 0 L 10 5 L 0 10 z" fill="{INK}"/></marker></defs>',
        f'<rect width="{W}" height="{H}" fill="#fff"/>',
    ]

    # Google Cloud: the only thing with a public address.
    parts += [
        box(300, 40, 360, 170, stroke_width=3),
        google_cloud_icon(318, 52),
        text(392, 84, "GOOGLE CLOUD", size=18, weight="bold"),
        text(392, 106, "public HTTPS, port 443", fill=MUTED),
        box(324, 128, 312, 62),
        text(480, 153, "server.py", size=15, anchor="middle", weight="bold"),
        text(480, 175, "game state / JSON API / QR SVGs", anchor="middle",
             fill=MUTED),
    ]

    # Admin phone: the only client that logs in.
    parts += [
        box(40, 75, 200, 100),
        text(140, 108, "ADMIN PHONE", size=18, anchor="middle", weight="bold"),
        text(140, 132, "/admin, password", anchor="middle", fill=MUTED),
        text(140, 152, "reset at any time", anchor="middle", fill=MUTED),
        arrow(240, 125, 300, 125),
    ]

    # Phones.
    parts += [
        box(40, 380, 300, 110),
        text(190, 418, "PHONES", size=18, anchor="middle", weight="bold"),
        text(190, 442, "visitors, any network", anchor="middle", fill=MUTED),
        text(190, 462, "REVEAL / FLAG page", anchor="middle", fill=MUTED),
    ]

    # Laptop and projector.
    parts += [
        box(620, 380, 300, 110),
        text(770, 418, "LAPTOP + PROJECTOR", size=18, anchor="middle",
             weight="bold"),
        text(770, 442, "browser only", anchor="middle", fill=MUTED),
        text(770, 462, "shows the board and QR codes", anchor="middle",
             fill=MUTED),
    ]

    # Phones to cloud.
    parts += [
        arrow(190, 380, 380, 210),
        text(250, 280, "GET /t/<id>  (scan)", anchor="end"),
        text(250, 298, "POST /api/reveal | flag", anchor="end"),
        text(250, 316, "HTTPS 443, mobile data", anchor="end", fill=MUTED),
    ]

    # Laptop to cloud.
    parts += [
        arrow(770, 380, 580, 210),
        text(712, 280, "GET /api/state  (poll)"),
        text(712, 298, "GET /qr/<id>.svg"),
        text(712, 316, "outbound HTTPS 443", fill=MUTED),
    ]

    # The wall is the only link between laptop and phones.
    parts += [
        arrow(620, 435, 340, 435, dashed=True),
        text(480, 424, "camera scans QR on the wall", anchor="middle",
             fill=MUTED),
    ]

    # Laptop uplink: library wifi, hotspot as fallback.
    parts += [
        line(690, 490, 690, 530),
        line(850, 490, 850, 530),
        box(620, 530, 140, 40),
        text(690, 555, "library wifi", anchor="middle"),
        box(780, 530, 140, 40, dashed=True),
        text(850, 555, "hotspot fallback", anchor="middle"),
        text(604, 555, "laptop uplink:", anchor="end", fill=MUTED),
    ]

    parts.append("</svg>")
    return "\n".join(parts) + "\n"


if __name__ == "__main__":
    OUT.write_text(build(), encoding="utf-8")
    print(f"wrote {OUT}")
