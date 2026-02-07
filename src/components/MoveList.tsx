"use client";

import type { Move } from "chess.js";
import clsx from "clsx";
import type { MoveAnalysis } from "@/lib/schemas";
import { formatEval } from "@/lib/classification";

const classificationStyles: Record<string, string> = {
  best: "bg-emerald-500/20 text-emerald-200",
  excellent: "bg-emerald-400/20 text-emerald-100",
  good: "bg-sky-500/20 text-sky-100",
  inaccuracy: "bg-amber-500/20 text-amber-100",
  mistake: "bg-orange-500/20 text-orange-100",
  blunder: "bg-rose-500/20 text-rose-100"
};

type MoveListProps = {
  moves: Move[];
  analysis: MoveAnalysis[];
  comments: Record<number, string>;
  currentIndex: number;
  onSelectMove: (index: number) => void;
};

export function MoveList({
  moves,
  analysis,
  comments,
  currentIndex,
  onSelectMove
}: MoveListProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Move List</h2>
      <div className="max-h-[480px] overflow-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-900 text-left">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">SAN</th>
              <th className="px-3 py-2">Eval Delta</th>
              <th className="px-3 py-2">CPL</th>
              <th className="px-3 py-2">Class</th>
              <th className="px-3 py-2">Comment</th>
            </tr>
          </thead>
          <tbody>
            {moves.map((move, index) => {
              const detail = analysis[index];
              const rowEval = detail
                ? `${formatEval(detail.evalBefore ?? undefined, detail.mateBefore ?? undefined)} -> ${formatEval(
                    detail.evalAfter ?? undefined,
                    detail.mateAfter ?? undefined
                  )}`
                : "--";
              return (
                <tr
                  key={`${index}-${move.san}`}
                  onClick={() => onSelectMove(index + 1)}
                  className={clsx(
                    "cursor-pointer border-t border-white/5 transition hover:bg-white/5",
                    currentIndex === index + 1 && "bg-white/10"
                  )}
                >
                  <td className="px-3 py-2 text-slate-400">{index + 1}</td>
                  <td className="px-3 py-2 font-medium">{move.san}</td>
                  <td className="px-3 py-2 text-slate-300">{rowEval}</td>
                  <td className="px-3 py-2">{detail ? detail.cpl : "--"}</td>
                  <td className="px-3 py-2">
                    {detail ? (
                      <span
                        className={clsx(
                          "rounded-full px-2 py-1 text-xs font-semibold",
                          classificationStyles[detail.classification]
                        )}
                      >
                        {detail.classification}
                      </span>
                    ) : (
                      <span className="text-slate-500">pending</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-200">
                    {comments[index] ?? (detail ? "Awaiting comment." : "")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
