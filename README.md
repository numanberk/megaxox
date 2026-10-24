# XOX Pop

A one-thumb puzzle game that works offline. Drag X and O pieces onto a 5×5 board. Three of the same mark in a row or column pops.

- **Blast:** four or more in a line also clears the rows next to it (or the columns, for a line going down).
- **Board wipe:** a line across and a line down that cross, one of them four long, clear the whole board.
- **Streak:** pop again on your next piece and points multiply.
- **Best-score chase:** a bar fills as you close in on your best, with a burst the moment you pass it.
- **Daily:** everyone gets the same pieces each day. Playing it on consecutive days builds a 🔥 streak.

The game ends when none of your three pieces fit.

Play: open `index.html`. Served over https (for example GitHub Pages), it installs to the home screen and works without internet after the first visit.

## Develop

- `src/game.js` rules: pieces, pops, blasts, wipes, scoring, difficulty, daily seed (no DOM)
- `src/ui.js`, `src/style.css`, `src/template.html` interface: drag or tap to place, Classic/Daily, effects, sounds, haptics, autosave
- `src/sw.js` offline cache template
- `node build.js` bundles everything into `index.html` and writes `sw.js`
- `node test/test_game.js` runs the tests
- `node test/sim.js 300` plays bots (random, casual, greedy) and reports game length, how often pieces pop, blast and wipe, and how crowded the board gets. Pass a JSON config to try tuning, e.g. `node test/sim.js 200 '{"blastLen":5}'`
- `node test/icons.js` renders `icon.svg` to the PNG app icons (needs Playwright)
