# CubRub (demo)

A small site that helps you solve a 2x2 or 3x3 Rubik's cube.

You pick a cube, paint the colors of your real cube on screen,
the site checks them, and shows a step-by-step solution in 3D.

Right now this is only a **demo**:

- the server starts, the page loads, but the app is not fully
  wired up yet;
- on the user's setup the cube solver does not produce a solution
  inside the browser, so the site will not actually solve a cube;
- styling, layout, and the empty sample version are all in place;
- the real working version is being finished and will replace
  this one later.

In short: the site looks alive, but it is a placeholder. Treat it
as a screenshot, not as a product.

## What it does

- Home page with two buttons: pick 2x2 or 3x3.
- "Solve" page: you paint six faces of your cube. Each sticker
  shows a color; the next face is described with a small 3D cube.
- "Patterns" page: a small catalogue of cube patterns.
- "Learn" page: a short course on solving the cube by hand.
- Two languages: Russian and English. No accounts, no tracking.

## How it is put together

- `apps/web/` is the web app (Preact + Vite + a tiny static server).
- `libs/` are small, focused packages for the cube model,
  input flow, validation, solver, storage, render, i18n,
  patterns, and learning.
- Tests live next to each file.
- The local server binds to `127.0.0.1:8000` by default.

## Quick start

```sh
deno task check
deno task test
deno task build
deno run --allow-net=127.0.0.1:8000 --allow-read=dist apps/web/main.ts
```

Open `http://127.0.0.1:8000/`.

## Credits

Created by Sorokin Kirill.
Cube-solver engine uses
[cubing.js](https://github.com/cubing/cubing.js).
