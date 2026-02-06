# Lichess PGN Coach

A production-ready MVP that parses a Lichess PGN, replays the game, runs Stockfish analysis in the browser, and generates actionable coaching commentary.

## Features
- PGN validation + header parsing (Event, White, Black, Result, ECO)
- Interactive board replay with playback controls and speed slider
- Progressive, move-by-move Stockfish evaluation in a Web Worker
- Move classification with configurable CPL thresholds
- JSON-based commentary API with Zod validation
- Key moments and final coaching report
- Local persistence of recent games in the browser

## Tech stack
- Next.js App Router + TypeScript
- chess.js for PGN parsing and legal move state
- react-chessboard for the UI board
- Stockfish running in a Web Worker
- Tailwind CSS for styling
- Zod for schema validation

## Getting started
```bash
npm install
npm run dev
```

Open `http://localhost:3000` and paste a PGN (a sample is available in `public/fixtures/sample-rapid.pgn`).

## Configuration
Create a `.env.local` file if you plan to connect the commentary API to a hosted LLM later:
```
OPENAI_API_KEY=your-key
```

## Tests
```bash
npm test
```

## Next improvements
- Import PGN directly from a Lichess URL
- Opening database lookup to annotate deviations
- Generate blunder puzzles from large CPL swings
