"use client";

type FinalReportProps = {
  openingNotes: string;
  middlegameTurningPoint: string;
  endgameNotes: string;
  trainingPriorities: string[];
};

export function FinalReport({
  openingNotes,
  middlegameTurningPoint,
  endgameNotes,
  trainingPriorities
}: FinalReportProps) {
  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
      <h2 className="text-lg font-semibold">Final Report</h2>
      <div className="space-y-3 text-sm text-slate-200">
        <div>
          <p className="font-semibold text-slate-100">Opening phase</p>
          <p>{openingNotes}</p>
        </div>
        <div>
          <p className="font-semibold text-slate-100">Middlegame turning point</p>
          <p>{middlegameTurningPoint}</p>
        </div>
        <div>
          <p className="font-semibold text-slate-100">Endgame conversion</p>
          <p>{endgameNotes}</p>
        </div>
        <div>
          <p className="font-semibold text-slate-100">Top 3 training priorities</p>
          <ol className="mt-1 list-decimal pl-5 text-slate-300">
            {trainingPriorities.map((priority) => (
              <li key={priority}>{priority}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
