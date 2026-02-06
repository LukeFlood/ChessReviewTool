import { Chess, Move } from "chess.js";

export type PgnHeaders = {
  Event?: string;
  White?: string;
  Black?: string;
  Result?: string;
  ECO?: string;
};

export type ParsedPgn = {
  headers: PgnHeaders;
  moves: Move[];
  initialFen: string;
};

export function parsePgn(pgn: string): ParsedPgn {
  const chess = new Chess();
  const ok = chess.loadPgn(pgn, { strict: true });
  if (!ok) {
    throw new Error("Invalid PGN. Please paste a complete Lichess PGN.");
  }
  const headers = chess.header();
  const moves = chess.history({ verbose: true });
  return {
    headers: {
      Event: headers.Event,
      White: headers.White,
      Black: headers.Black,
      Result: headers.Result,
      ECO: headers.ECO
    },
    moves,
    initialFen: new Chess().fen()
  };
}
