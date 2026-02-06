export type Classification =
  | "best"
  | "excellent"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder";

export type ClassificationThresholds = {
  bestExcellentMax: number;
  goodMax: number;
  inaccuracyMax: number;
  mistakeMax: number;
};

export const defaultThresholds: ClassificationThresholds = {
  bestExcellentMax: 20,
  goodMax: 60,
  inaccuracyMax: 120,
  mistakeMax: 250
};

export function classifyCpl(
  cpl: number,
  isMateBlunder: boolean,
  thresholds: ClassificationThresholds = defaultThresholds
): Classification {
  if (isMateBlunder) {
    return "blunder";
  }

  if (cpl <= thresholds.bestExcellentMax) {
    return cpl <= thresholds.bestExcellentMax / 2 ? "best" : "excellent";
  }
  if (cpl <= thresholds.goodMax) {
    return "good";
  }
  if (cpl <= thresholds.inaccuracyMax) {
    return "inaccuracy";
  }
  if (cpl <= thresholds.mistakeMax) {
    return "mistake";
  }
  return "blunder";
}

export function formatEval(cp?: number, mate?: number): string {
  if (typeof mate === "number") {
    return `#${mate}`;
  }
  if (typeof cp === "number") {
    return (cp / 100).toFixed(2);
  }
  return "--";
}
