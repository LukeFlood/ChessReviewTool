// The package root points to a missing file in stockfish@16.0.0, so import a concrete engine bundle.
import Stockfish from "stockfish/src/stockfish-nnue-16-single.js";

type AnalyzeMessage = {
  type: "analyze";
  id: string;
  fen: string;
  depth?: number;
  movetime?: number;
};

type StopMessage = {
  type: "stop";
};

type WorkerMessage = AnalyzeMessage | StopMessage;

type EngineScore = {
  cp?: number;
  mate?: number;
};

const engine = Stockfish();
let latestId: string | null = null;
let latestScore: EngineScore = {};

const sendResult = (id: string, score: EngineScore) => {
  self.postMessage({
    type: "analysis",
    id,
    score
  });
};

engine.onmessage = (event: MessageEvent | string) => {
  const line = typeof event === "string" ? event : event.data;
  if (typeof line !== "string") return;

  if (line.startsWith("info")) {
    const matchCp = line.match(/score cp (-?\d+)/);
    const matchMate = line.match(/score mate (-?\d+)/);
    if (matchCp) {
      latestScore = { cp: Number(matchCp[1]) };
    }
    if (matchMate) {
      latestScore = { mate: Number(matchMate[1]) };
    }
  }

  if (line.startsWith("bestmove") && latestId) {
    sendResult(latestId, latestScore);
    latestId = null;
  }
};

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  if (message.type === "stop") {
    engine.postMessage("stop");
    latestId = null;
    return;
  }

  latestId = message.id;
  latestScore = {};
  engine.postMessage("uci");
  engine.postMessage("isready");
  engine.postMessage(`position fen ${message.fen}`);
  if (message.movetime && message.movetime > 0) {
    engine.postMessage(`go movetime ${message.movetime}`);
  } else {
    engine.postMessage(`go depth ${message.depth ?? 12}`);
  }
};
