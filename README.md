# CubRub (demo)

This is a small demo site that looks like a 2x2 / 3x3 Rubik's cube solver.

Pick a cube size, paint the colors of your real cube, and the site
shows a 3D preview.

**Right now the real solver does not work** on the user's setup, so
this site will not actually solve a cube. It is here mostly as a
screenshot of the design.

## Live build

The static site is published from `main`:

<https://handmade12.github.io/CubRub/>

## What the demo does

- Home page with two buttons to pick **2x2** or **3x3**.
- A capture screen where you paint the six faces of your cube.
- A patterns page with a few ready-made cube designs.
- A learn page that walks through solving the cube by hand.
- Russian and English.

## Tech stack

- **Deno** workspace with a small set of pure-domain libraries:
  cube model, input flow, solver wrapper, storage, render, i18n,
  patterns, learning.
- **Preact + Vite** for the client bundle.
- **cubing.js** powers the 3D cube preview.
- A tiny **Deno** static server for local development.

## Run it locally

You need [Deno](https://deno.com/) 1.45+.

```sh
deno task check     # format + lint + typecheck
deno task test      # run the unit tests
deno task build     # produce apps/web/dist
deno run --allow-net=127.0.0.1:8000 --allow-read=dist apps/web/main.ts
```

Then open <http://127.0.0.1:8000/>.

## Privacy

All saved data lives in `localStorage` under `cuberub:*` keys.
No accounts. No telemetry. No outbound traffic beyond the cubing.js
worker that ships with the repo.

## Credits

Made by **Sorokin Kirill**.

Cube preview engine:
[cubing.js](https://github.com/cubing/cubing.js)
(MPL-2.0 OR GPL-3.0-or-later).
