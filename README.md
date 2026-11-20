# QR Minesweeper

Minesweeper for a wall. The board is projected; every hidden tile is a QR code.
Scan a tile with your phone, choose REVEAL or FLAG, and it happens on the wall.

![The projected board mid-game](docs/wall.png)

<p align="center">
  <img src="docs/phone.png" alt="The phone page after scanning a tile" width="320">
</p>

## Original prompt

The whole thing was built from this one prompt:

> use a pythonn server nad plain js+css. Make like a grid of QR codes, then when
> you scan it it sends something to the server so it unlocks that tile, thats
> how you play minesweeper, it willbe projected on a giant wall. styling is
> black and white and minimalistic, like marathon!!

Followed by one change request: instead of revealing on scan, the phone should
let you choose REVEAL or FLAG, since the PC driving the projector is hidden.

## Run

```
pip install -r requirements.txt
python server.py
```

Open `http://localhost:8000/` on the projector machine and press `F` for fullscreen.
Phones must be on the same network as the server. The QR codes encode the
machine's LAN address, which is auto-detected. Override it if the guess is wrong:

```
python server.py --host 192.168.1.20
python server.py --base-url http://mines.local:8000
```

Board size and difficulty:

```
python server.py --cols 12 --rows 7 --mines 14
```

A finished board stays up for 10 seconds, then a new round starts on its own.
Change that with `--restart-after 30`, or `--restart-after 0` to turn it off.

## Admin

Set `ADMIN_PASSWORD` before starting the server, then open `/admin` on your
phone and log in. The page shows the live board status and a NEW GAME button
that works at any time.

That button is the only manual reset. Players cannot reset the board, and the
projector has no reset key, since its keyboard is within reach of visitors.
Without a password, `/admin` is disabled and nobody can reset by hand.

## Rules

- Scanning a hidden tile opens a page on the phone with two buttons: REVEAL or FLAG.
- The first reveal of a round is always safe.
- Zero tiles flood open their neighbours, as usual.
- A mine ends the round. Revealing every safe tile wins it.
- A flagged tile shows a hollow square instead of its QR code, so it cannot be
  scanned again. Flag carefully.
- If every tile that is left is flagged and one of those flags is wrong, the
  round is lost: the wall says FAILED and strikes through the wrong flags.
- After a round, the wall counts down and a new round starts by itself.

## Stack

- `server.py`: Python standard library `http.server`, plus the `qrcode` package
  for the QR SVGs. Holds the game state and serves the JSON API.
- `static/index.html`, `style.css`, `app.js`: the projector view. Plain JS,
  polls the board state a few times per second.
- `static/tile.html`, `tile.js`: the phone page a QR code opens.

## Endpoints

| Route                   | Purpose                                   |
| ----------------------- | ----------------------------------------- |
| `GET /`                 | projector board                           |
| `GET /t/<id>`           | phone page (what the QR encodes)          |
| `GET /qr/<id>.svg`      | QR code for a tile                        |
| `GET /api/tile/<id>`    | one tile's state (used by the phone page) |
| `GET /api/state`        | board state (polled by the projector)     |
| `POST /api/reveal/<id>` | reveal a tile                             |
| `POST /api/flag/<id>`   | toggle a flag                             |
| `POST /api/reset`       | new round (admin only)                    |
| `GET /admin`            | admin page                                |
| `POST /api/admin/login` | log in with the admin password            |
