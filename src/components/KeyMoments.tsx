"use client";

type KeyMomentsProps = {
  biggestSwing?: string;
  firstMistakeWhite?: string;
  firstMistakeBlack?: string;
  missedTactics: string[];
};

export function KeyMoments({
  biggestSwing,
  firstMistakeWhite,
  firstMistakeBlack,
  missedTactics
}: KeyMomentsProps) {
  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
      <h2 className="text-lg font-semibold">Key Moments</h2>
      <ul className="space-y-2 text-sm text-slate-200">
        <li>
          <span className="font-semibold text-slate-100">Biggest eval swing:</span>{" "}
          {biggestSwing ?? "Pending analysis."}
        </li>
        <li>
          <span className="font-semibold text-slate-100">First serious mistake (White):</span>{" "}
          {firstMistakeWhite ?? "Pending analysis."}
        </li>
        <li>
          <span className="font-semibold text-slate-100">First serious mistake (Black):</span>{" "}
          {firstMistakeBlack ?? "Pending analysis."}
        </li>
        <li>
          <span className="font-semibold text-slate-100">Missed tactics:</span>
          <ul className="mt-1 list-disc pl-5 text-slate-300">
            {missedTactics.length === 0 ? (
              <li>Pending analysis.</li>
            ) : (
              missedTactics.map((tactic, index) => <li key={`${tactic}-${index}`}>{tactic}</li>)
            )}
          </ul>
        </li>
      </ul>
    </div>
  );
}
