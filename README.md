# XOX Pop

A one-thumb puzzle game that works offline. Drag X and O pieces onto a 6×6 board. Three of the same mark in a line (across, down or diagonal) pops. Pop again on your next piece for a streak bonus. The game ends when none of your three pieces fit.

Play: open `index.html`. Served over https (for example GitHub Pages), it installs to the home screen and works without internet after the first visit.

## Develop

- `src/game.js` rules: pieces, popping, scoring, difficulty ramp (no DOM)
- `src/ui.js`, `src/style.css`, `src/template.html` interface: drag or tap to place, sounds, haptics, autosave
- `src/sw.js` offline cache template
- `node build.js` bundles everything into `index.html` and writes `sw.js`
- `node test/test_game.js` runs the tests
- `node test/sim.js 300` plays bots (random, casual, greedy) to show how long games last; pass a JSON config to try tuning, e.g. `node test/sim.js 200 '{"diagonals":false}'`
- `node test/icons.js` renders `icon.svg` to the PNG app icons (needs Playwright)
