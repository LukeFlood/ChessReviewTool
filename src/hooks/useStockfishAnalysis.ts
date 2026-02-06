"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Move } from "chess.js";
import { Chess } from "chess.js";
import { classifyCpl } from "@/lib/classification";
import type { MoveAnalysis } from "@/lib/schemas";

export type AnalysisSettings = {
  depth: number;
  movetime: number;
};

type EngineScore = {
  cp?: number;
  mate?: number;
};

const emptyScore: EngineScore = {};

const scoreToEval = (score: EngineScore) => {
  if (typeof score.mate === "number") {
    return { mate: score.mate, cp: null };
  }
  if (typeof score.cp === "number") {
    return { cp: score.cp, mate: null };
  }
  return { cp: null, mate: null };
};

const calculateCpl = (
  moveColor: "w" | "b",
  before: EngineScore,
  after: EngineScore
) => {
  const beforeCp = before.cp ?? 0;
  const afterCp = after.cp ?? 0;
  const raw =
    moveColor === "w"
      ? Math.max(0, beforeCp - afterCp)
      : Math.max(0, afterCp - beforeCp);
  return Math.round(raw);
};

const isMateBlunder = (moveColor: "w" | "b", score: EngineScore) => {
  if (typeof score.mate !== "number") return false;
  return moveColor === "w" ? score.mate < 0 : score.mate > 0;
};

export function useStockfishAnalysis(moves: Move[], settings: AnalysisSettings) {
  const [analysis, setAnalysis] = useState<MoveAnalysis[]>([]);
  const [inProgress, setInProgress] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const queueRef = useRef<string[]>([]);
  const scoresRef = useRef<Record<string, EngineScore>>({});

  const fens = useMemo(() => {
    const chess = new Chess();
    const fenList: string[] = [chess.fen()];
    moves.forEach((move) => {
      chess.move(move);
      fenList.push(chess.fen());
    });
    return fenList;
  }, [moves]);

  useEffect(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("../workers/stockfishWorker.ts", import.meta.url),
        { type: "module" }
      );
    }
    const worker = workerRef.current;

    const handleMessage = (event: MessageEvent) => {
      const { type, id, score } = event.data as {
        type: "analysis";
        id: string;
        score: EngineScore;
      };
      if (type !== "analysis") return;
      scoresRef.current[id] = score;

      const nextId = queueRef.current.shift();
      if (nextId) {
        const [moveIndexStr, phase] = nextId.split(":");
        const moveIndex = Number(moveIndexStr);
        const fenIndex = phase === "before" ? moveIndex : moveIndex + 1;
        const fen = fens[fenIndex];
        worker.postMessage({
          type: "analyze",
          id: nextId,
          fen,
          depth: settings.depth,
          movetime: settings.movetime
        });
      } else {
        setInProgress(false);
      }

      const moveIndex = Number(id.split(":")[0]);
      const beforeKey = `${moveIndex}:before`;
      const afterKey = `${moveIndex}:after`;
      if (!(beforeKey in scoresRef.current) || !(afterKey in scoresRef.current)) {
        return;
      }
      const beforeScore = scoresRef.current[beforeKey] ?? emptyScore;
      const afterScore = scoresRef.current[afterKey] ?? emptyScore;

      if (!moves[moveIndex]) return;

      const move = moves[moveIndex];
      const cpl = calculateCpl(move.color, beforeScore, afterScore);
      const classification = classifyCpl(cpl, isMateBlunder(move.color, afterScore));
      const evalBefore = scoreToEval(beforeScore);
      const evalAfter = scoreToEval(afterScore);

      setAnalysis((prev) => {
        const next = [...prev];
        next[moveIndex] = {
          moveIndex,
          san: move.san,
          evalBefore: evalBefore.cp,
          evalAfter: evalAfter.cp,
          mateBefore: evalBefore.mate,
          mateAfter: evalAfter.mate,
          cpl,
          classification
        };
        return next;
      });
    };

    worker.addEventListener("message", handleMessage);
    return () => {
      worker.removeEventListener("message", handleMessage);
    };
  }, [fens, moves, settings.depth, settings.movetime]);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;

    worker.postMessage({ type: "stop" });
    setAnalysis([]);
    setInProgress(false);
    queueRef.current = [];
    scoresRef.current = {};

    if (moves.length === 0) {
      return;
    }

    setInProgress(true);
    const queue: string[] = [];
    moves.forEach((_, index) => {
      queue.push(`${index}:before`);
      queue.push(`${index}:after`);
    });
    queueRef.current = queue.slice(1);

    const firstId = queue[0];
    if (!firstId) return;
    const [moveIndexStr] = firstId.split(":");
    const fen = fens[Number(moveIndexStr)];
    worker.postMessage({
      type: "analyze",
      id: firstId,
      fen,
      depth: settings.depth,
      movetime: settings.movetime
    });
  }, [fens, moves, settings]);

  return { analysis, inProgress };
}
