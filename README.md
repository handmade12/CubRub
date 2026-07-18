# CubRub (demo)

A small demo site that looks like a 2x2 / 3x3 Rubik's cube solver.

Pick a cube size, paint the colors of your real cube, and the
site shows a 3D preview.

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

## Privacy

All saved data stays in your browser. No accounts, no tracking,
no background calls to any server.

## Credits

Made by **Sorokin Kirill**.

The 3D cube preview uses
[cubing.js](https://github.com/cubing/cubing.js)
(MPL-2.0 OR GPL-3.0-or-later).
