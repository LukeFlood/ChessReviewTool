import Stockfish from "stockfish/src/stockfish-nnue-16-single.js";

const STOCKFISH_WASM_PATH = "/stockfish/stockfish-nnue-16-single.wasm";

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
  pv?: string[];
  bestmove?: string;
};

let latestId: string | null = null;
let latestScore: EngineScore = {};
let engine:
  | {
      onmessage: ((event: MessageEvent | string) => void) | null;
      postMessage: (message: string) => void;
    }
  | null = null;

const sendError = (message: string) => {
  self.postMessage({
    type: "error",
    message
  });
};

const sendResult = (id: string, score: EngineScore) => {
  self.postMessage({
    type: "analysis",
    id,
    score
  });
};

const ensureEngine = () => {
  if (engine) return engine;
  engine = Stockfish({
    locateFile: (path: string) =>
      path.endsWith(".wasm") ? STOCKFISH_WASM_PATH : path
  });
  return engine;
};

const handleEngineMessage = (event: MessageEvent | string) => {
  const line = typeof event === "string" ? event : event.data;
  if (typeof line !== "string") return;

  if (line.startsWith("info")) {
    const matchCp = line.match(/score cp (-?\d+)/);
    const matchMate = line.match(/score mate (-?\d+)/);
    const matchPv = line.match(/\spv\s(.+)$/);

    if (matchCp) {
      latestScore = { ...latestScore, cp: Number(matchCp[1]), mate: undefined };
    }
    if (matchMate) {
      latestScore = { ...latestScore, mate: Number(matchMate[1]), cp: undefined };
    }
    if (matchPv) {
      latestScore = {
        ...latestScore,
        pv: matchPv[1].trim().split(/\s+/).slice(0, 8)
      };
    }
  }

  if (line.startsWith("bestmove") && latestId) {
    const bestmove = line.split(/\s+/)[1];
    if (bestmove && bestmove !== "(none)") {
      latestScore = { ...latestScore, bestmove };
    }
    sendResult(latestId, latestScore);
    latestId = null;
  }
};

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  try {
    const sf = ensureEngine();
    sf.onmessage = handleEngineMessage;

    if (message.type === "stop") {
      sf.postMessage("stop");
      latestId = null;
      return;
    }

    latestId = message.id;
    latestScore = {};
    sf.postMessage("uci");
    sf.postMessage("isready");
    sf.postMessage(`position fen ${message.fen}`);
    if (message.movetime && message.movetime > 0) {
      sf.postMessage(`go movetime ${message.movetime}`);
    } else {
      sf.postMessage(`go depth ${message.depth ?? 12}`);
    }
  } catch (error) {
    latestId = null;
    sendError(
      error instanceof Error
        ? `Stockfish engine failed to load: ${error.message}`
        : "Stockfish worker failed."
    );
  }
};
