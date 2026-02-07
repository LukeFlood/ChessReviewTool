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
  try {
    chess.loadPgn(pgn, { strict: true });
  } catch {
    throw new Error("Invalid PGN. Please paste a complete Lichess PGN.");
  }
  const headers = chess.header();
  const moves = chess.history({ verbose: true });
  return {
    headers: {
      Event: headers.Event ?? undefined,
      White: headers.White ?? undefined,
      Black: headers.Black ?? undefined,
      Result: headers.Result ?? undefined,
      ECO: headers.ECO ?? undefined
    },
    moves,
    initialFen: new Chess().fen()
  };
}
