import { describe, expect, it } from "vitest";
import { parsePgn } from "@/lib/pgn";

const validPgn = `[Event "Lichess Casual"]
[Site "https://lichess.org/abcd1234"]
[Date "2024.04.01"]
[White "Coach"]
[Black "Student"]
[Result "1-0"]
[ECO "C20"]

1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0`;

describe("parsePgn", () => {
  it("parses a valid PGN and exposes headers/moves", () => {
    const parsed = parsePgn(validPgn);

    expect(parsed.headers.White).toBe("Coach");
    expect(parsed.headers.Black).toBe("Student");
    expect(parsed.moves).toHaveLength(7);
    expect(parsed.moves[0]?.san).toBe("e4");
    expect(parsed.moves[6]?.san).toBe("Qxf7#");
  });

  it("throws a friendly error on invalid PGN", () => {
    expect(() => parsePgn("1. e4 e5 2. NotAMove")).toThrow(
      "Invalid PGN. Please paste a complete Lichess PGN."
    );
  });
});
