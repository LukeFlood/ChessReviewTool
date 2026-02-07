"use client";

import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { parsePgn } from "@/lib/pgn";
import { MoveList } from "@/components/MoveList";
import { BoardControls } from "@/components/BoardControls";
import { KeyMoments } from "@/components/KeyMoments";
import { FinalReport } from "@/components/FinalReport";
import { useStockfishAnalysis } from "@/hooks/useStockfishAnalysis";
import type { MoveAnalysis, CommentaryResponse } from "@/lib/schemas";

const DEFAULT_PGN = `[Event "Lichess Casual"]\n[Site "https://lichess.org/abcd1234"]\n[Date "2024.04.01"]\n[White "Coach"]\n[Black "Student"]\n[Result "1-0"]\n[ECO "C20"]\n\n1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0`;

const STORAGE_KEY = "lichess-pgn-coach/recent";

type RecentGame = {
  pgn: string;
  label: string;
  savedAt: string;
};

const emptySummary = {
  openingNotes: "Awaiting commentary.",
  middlegameTurningPoint: "Awaiting commentary.",
  endgameNotes: "Awaiting commentary.",
  trainingPriorities: [
    "Awaiting commentary.",
    "Awaiting commentary.",
    "Awaiting commentary."
  ]
};

export default function HomePage() {
  const [pgnInput, setPgnInput] = useState(DEFAULT_PGN);
  const [parsedError, setParsedError] = useState<string | null>(null);
  const [moves, setMoves] = useState<ReturnType<typeof parsePgn>["moves"]>([]);
  const [headers, setHeaders] = useState<ReturnType<typeof parsePgn>["headers"]>({});
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [speed, setSpeed] = useState(900);
  const [isPlaying, setIsPlaying] = useState(false);
  const [depth, setDepth] = useState(12);
  const [movetime, setMovetime] = useState(0);
  const [comments, setComments] = useState<Record<number, string>>({});
  const [summary, setSummary] = useState(emptySummary);
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);

  const { analysis, inProgress } = useStockfishAnalysis(moves, { depth, movetime });
  const analysisComplete = analysis.filter(Boolean).length === moves.length && moves.length > 0;

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setRecentGames(JSON.parse(stored) as RecentGame[]);
      } catch {
        setRecentGames([]);
      }
    }
  }, []);

  const fens = useMemo(() => {
    const chess = new Chess();
    const list: string[] = [chess.fen()];
    moves.forEach((move) => {
      chess.move(move);
      list.push(chess.fen());
    });
    return list;
  }, [moves]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setCurrentMoveIndex((prev) => {
        if (prev >= moves.length) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, speed);
    return () => clearInterval(timer);
  }, [isPlaying, moves.length, speed]);

  useEffect(() => {
    if (!analysisComplete) {
      setComments({});
      setSummary(emptySummary);
    }
  }, [analysisComplete]);

  const keyMoments = useMemo(() => {
    const completeAnalysis = analysis.filter(Boolean) as MoveAnalysis[];
    if (completeAnalysis.length === 0) {
      return { biggestSwing: undefined, firstMistakeWhite: undefined, firstMistakeBlack: undefined, missedTactics: [] as string[] };
    }
    let biggestSwing: MoveAnalysis | undefined;
    let firstMistakeWhite: MoveAnalysis | undefined;
    let firstMistakeBlack: MoveAnalysis | undefined;
    const missedTactics: string[] = [];

    for (const [index, move] of completeAnalysis.entries()) {
      const swing = Math.abs((move.evalAfter ?? 0) - (move.evalBefore ?? 0));
      if (!biggestSwing || swing > Math.abs((biggestSwing.evalAfter ?? 0) - (biggestSwing.evalBefore ?? 0))) {
        biggestSwing = move;
      }
      if (move.cpl > 150) {
        missedTactics.push(`Move ${index + 1} (${move.san}) lost ${move.cpl} CPL.`);
      }
      if (move.classification === "mistake" || move.classification === "blunder") {
        if (moves[index].color === "w" && !firstMistakeWhite) {
          firstMistakeWhite = move;
        }
        if (moves[index].color === "b" && !firstMistakeBlack) {
          firstMistakeBlack = move;
        }
      }
    }

    return {
      biggestSwing: biggestSwing
        ? `Move ${biggestSwing.moveIndex + 1} (${biggestSwing.san}) swung the eval by ${Math.abs(
            (biggestSwing.evalAfter ?? 0) - (biggestSwing.evalBefore ?? 0)
          )} cp.`
        : undefined,
      firstMistakeWhite: firstMistakeWhite
        ? `Move ${firstMistakeWhite.moveIndex + 1} (${firstMistakeWhite.san}) flagged as a ${firstMistakeWhite.classification}.`
        : undefined,
      firstMistakeBlack: firstMistakeBlack
        ? `Move ${firstMistakeBlack.moveIndex + 1} (${firstMistakeBlack.san}) flagged as a ${firstMistakeBlack.classification}.`
        : undefined,
      missedTactics
    };
  }, [analysis, moves]);

  useEffect(() => {
    if (!analysisComplete) return;

    const payload = {
      metadata: headers,
      moves: analysis.filter(Boolean),
      keyMoments
    };

    const requestComments = async () => {
      const response = await fetch("/api/commentary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) return;
      const data = (await response.json()) as CommentaryResponse;
      const commentMap: Record<number, string> = {};
      data.moveComments.forEach((comment) => {
        commentMap[comment.moveIndex] = comment.comment;
      });
      setComments(commentMap);
      setSummary(data.summary);
    };

    requestComments().catch(() => null);
  }, [analysis, analysisComplete, headers, keyMoments, moves.length]);

  const handleAnalyze = () => {
    setParsedError(null);
    try {
      const parsed = parsePgn(pgnInput.trim());
      setMoves(parsed.moves);
      setHeaders(parsed.headers);
      setCurrentMoveIndex(0);
      setIsPlaying(false);
      const entry: RecentGame = {
        pgn: pgnInput.trim(),
        label: `${parsed.headers.White ?? "White"} vs ${parsed.headers.Black ?? "Black"} (${parsed.headers.Result ?? "*"})`,
        savedAt: new Date().toISOString()
      };
      const next = [entry, ...recentGames].slice(0, 6);
      setRecentGames(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      setParsedError((error as Error).message);
      setMoves([]);
      setHeaders({});
    }
  };

  const currentFen = fens[currentMoveIndex] ?? fens[0];

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Lichess PGN Coach</p>
        <h1 className="text-3xl font-semibold">Engine-backed PGN reviews in minutes.</h1>
        <p className="text-slate-300">
          Paste a Lichess PGN, replay the game, and get coaching insights with move-by-move evaluations.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">PGN Input</h2>
            <button className="btn" onClick={() => setPgnInput("")}>Clear</button>
          </div>
          <textarea
            value={pgnInput}
            onChange={(event) => setPgnInput(event.target.value)}
            rows={10}
            className="w-full rounded-lg border border-slate-200/20 bg-white/90 p-3 text-sm text-slate-900"
            placeholder="Paste Lichess PGN here..."
          />
          {parsedError && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
              {parsedError}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn" onClick={handleAnalyze}>Analyze PGN</button>
            <div className="text-xs text-slate-300">
              Depth: {depth} | Movetime: {movetime ? `${movetime}ms` : "off"}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs uppercase text-slate-400">
              Depth
              <input
                type="number"
                min={6}
                max={20}
                value={depth}
                onChange={(event) => setDepth(Number(event.target.value))}
                className="mt-1 w-full rounded-md border border-white/20 bg-white/10 p-2 text-sm"
              />
            </label>
            <label className="text-xs uppercase text-slate-400">
              Time per move (ms)
              <input
                type="number"
                min={0}
                max={4000}
                value={movetime}
                onChange={(event) => setMovetime(Number(event.target.value))}
                className="mt-1 w-full rounded-md border border-white/20 bg-white/10 p-2 text-sm"
              />
            </label>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold">Game Headers</h2>
          <div className="grid gap-3 text-sm text-slate-300">
            <div>Event: {headers.Event ?? "-"}</div>
            <div>White: {headers.White ?? "-"}</div>
            <div>Black: {headers.Black ?? "-"}</div>
            <div>Result: {headers.Result ?? "-"}</div>
            <div>ECO: {headers.ECO ?? "-"}</div>
          </div>
          <div className="border-t border-white/10 pt-3">
            <h3 className="text-sm font-semibold text-slate-200">Recent games</h3>
            <ul className="mt-2 space-y-2 text-xs text-slate-300">
              {recentGames.length === 0 ? (
                <li>No recent games saved yet.</li>
              ) : (
                recentGames.map((game) => (
                  <li key={game.savedAt}>
                    <button
                      className="text-left underline-offset-2 hover:underline"
                      onClick={() => setPgnInput(game.pgn)}
                    >
                      {game.label}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
          <Chessboard position={currentFen} boardWidth={420} />
          <BoardControls
            isPlaying={isPlaying}
            speed={speed}
            onSpeedChange={setSpeed}
            onFirst={() => setCurrentMoveIndex(0)}
            onPrev={() => setCurrentMoveIndex((prev) => Math.max(prev - 1, 0))}
            onNext={() => setCurrentMoveIndex((prev) => Math.min(prev + 1, moves.length))}
            onLast={() => setCurrentMoveIndex(moves.length)}
            onTogglePlay={() => setIsPlaying((prev) => !prev)}
          />
          <div className="text-xs text-slate-400">
            {inProgress ? "Analyzing moves..." : moves.length > 0 ? "Analysis complete." : "Awaiting PGN."}
          </div>
        </div>

        <MoveList
          moves={moves}
          analysis={analysis}
          comments={comments}
          currentIndex={currentMoveIndex}
          onSelectMove={setCurrentMoveIndex}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <KeyMoments
          biggestSwing={keyMoments.biggestSwing}
          firstMistakeWhite={keyMoments.firstMistakeWhite}
          firstMistakeBlack={keyMoments.firstMistakeBlack}
          missedTactics={keyMoments.missedTactics}
        />
        <FinalReport
          openingNotes={summary.openingNotes}
          middlegameTurningPoint={summary.middlegameTurningPoint}
          endgameNotes={summary.endgameNotes}
          trainingPriorities={summary.trainingPriorities}
        />
      </section>
    </main>
  );
}
