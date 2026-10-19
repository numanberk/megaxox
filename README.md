# XOX Rogue

A mobile-first roguelike built on tic-tac-toe. The AI never blunders, so you win by collecting relics that bend the rules. Four in a row wins on a 5x5 board, and each act ends in a Super XOX boss fight.

Play: open `index.html` (single self-contained file).

## Develop

- `src/engine.js` board rules and search AI (5x5 and Super XOX)
- `src/game.js` relics, run flow, shop, bosses
- `src/ui.js`, `src/style.css`, `src/template.html` interface
- `node build.js` bundles everything into `index.html`
- `node test/test_game.js` runs the logic tests
