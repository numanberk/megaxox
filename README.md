# XOX Rogue

A mobile-first roguelike built on tic-tac-toe. Pick a character, collect relics that combo in sets, pick your opponent before each match, and beat three bosses that each play a different game.

Play: open `index.html` (single self-contained file).

## What's in a run

- **Characters:** Frost and Ember to start; Thief, Twin and Knight unlock by beating bosses.
- **Relic sets:** Frost, Fire, Tempo, Luck and Guard. Own 2 or 3 of a set for a bonus.
- **Opponents:** nine named opponents, each with one habit you can play around.
- **Bosses:** Speed Round (best of 3 on 3x3, timed), Gravity (marks drop, the floor falls), Super XOX (first to 3 boards, three phases). Every relic works in every game.

## Develop

- `src/engine.js` search AI for any k-in-a-row grid (5x5, 3x3, gravity) and Super XOX
- `src/game.js` characters, relics, sets, opponents, bosses, run flow
- `src/ui.js`, `src/style.css`, `src/template.html` interface
- `node build.js` bundles everything into `index.html`
- `node test/test_engine.js` and `node test/test_game.js` run the tests
- `node test/balance.js 3` plays a strong bot against every opponent and boss
