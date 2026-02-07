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

type EngineInstance = {
  onmessage?: ((event: MessageEvent | string) => void) | null;
  postMessage?: (message: string) => void;
  postCustomMessage?: (message: string) => void;
  addMessageListener?: (listener: (message: string) => void) => void;
};

let latestId: string | null = null;
let latestScore: EngineScore = {};
let engineReady: Promise<EngineInstance> | null = null;
let listenerAttached = false;

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

const normalizeEngine = (maybeEngine: unknown): EngineInstance => {
  if (!maybeEngine || typeof maybeEngine !== "object") {
    throw new Error("Stockfish factory returned invalid engine object.");
  }
  const engine = maybeEngine as EngineInstance;
  if (
    typeof engine.postMessage !== "function" &&
    typeof engine.postCustomMessage === "function"
  ) {
    engine.postMessage = engine.postCustomMessage;
  }
  if (typeof engine.postMessage !== "function") {
    throw new Error("Stockfish engine does not expose postMessage.");
  }
  return engine;
};

const ensureEngine = async () => {
  if (!engineReady) {
    const maybeEngine = Stockfish({
      locateFile: (path: string) =>
        path.endsWith(".wasm") ? STOCKFISH_WASM_PATH : path
    });
    engineReady = Promise.resolve(maybeEngine).then(normalizeEngine);
  }
  return engineReady;
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

const attachMessageListener = (sf: EngineInstance) => {
  if (listenerAttached) return;
  if (typeof sf.addMessageListener === "function") {
    sf.addMessageListener((line) => handleEngineMessage(line));
    listenerAttached = true;
    return;
  }
  if ("onmessage" in sf) {
    sf.onmessage = handleEngineMessage;
    listenerAttached = true;
    return;
  }
  throw new Error("Stockfish engine has no message listener API.");
};

const postToEngine = (sf: EngineInstance, message: string) => {
  if (typeof sf.postMessage !== "function") {
    throw new Error("Stockfish engine postMessage is not available.");
  }
  sf.postMessage(message);
};

const handleWorkerMessage = async (message: WorkerMessage) => {
  try {
    const sf = await ensureEngine();
    attachMessageListener(sf);

    if (message.type === "stop") {
      postToEngine(sf, "stop");
      latestId = null;
      return;
    }

    latestId = message.id;
    latestScore = {};
    postToEngine(sf, "uci");
    postToEngine(sf, "isready");
    postToEngine(sf, `position fen ${message.fen}`);
    if (message.movetime && message.movetime > 0) {
      postToEngine(sf, `go movetime ${message.movetime}`);
    } else {
      postToEngine(sf, `go depth ${message.depth ?? 12}`);
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

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  void handleWorkerMessage(event.data);
};
