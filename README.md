# CubRub

A small website that teaches you to solve a Rubik's Cube.

You choose a 2×2 or 3×3 cube, paint the colors of your cube,
type of cube, and follow a clear step-by-step solution in 3D.

- Languages: Russian and English.
- Solves 2×2 and 3×3 in-browser or via a small local server.
- No accounts. Data stays in your browser.

## Quick start

You need [Deno](https://deno.com/) 1.45+.

```sh
# run checks (format + lint + typecheck)
deno task check

# run tests
deno task test

# build the client
deno task build

# start the local server
deno run --allow-net=127.0.0.1:8000 --allow-read=dist apps/web/main.ts --port 8000
```

Then open `http://127.0.0.1:8000/` in your browser.

## Project layout

```
apps/web/   The web app (Preact + Vite + a small static server)
libs/       Pure-domain libraries (cube model, input, solver, etc.)
```

Each library is small and has its own tests:

- `cube-core`: cube model, moves, geometry.
- `cube-input`: capture flow for six faces, anchor / lock.
- `cube-validation`: physical sanity checks (orientation, parity).
- `cube-solver`: thin wrapper around cubing.js.
- `cube-application`: orchestrates capture → review → result stages.
- `cube-storage`: tiny key/value adapter for `localStorage`.
- `cube-render`: SVG visualizations.
- `cube-i18n`: messages for Russian and English.
- `cube-patterns`, `cube-learning`: catalog content.

## Browser data

All saved data lives in `localStorage` under `cuberub:*` keys.
The site talks to nothing external except, optionally, the cubing.js
worker that ships with this repo.

## Security

- No backend accounts. No telemetry.
- Strict CSP, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`.
- The local server binds to `127.0.0.1:8000` by default.
  Pass `--host 0.0.0.0 --port 8080` to expose it.

## Credits

Created by Sorokin Kirill.
Cube-solver engine: [cubing.js](https://github.com/cubing/cubing.js)
(MPL-2.0 OR GPL-3.0-or-later).
