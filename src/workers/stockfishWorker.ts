import Stockfish from "stockfish/src/stockfish-nnue-16-single.js";

const STOCKFISH_WASM_PATH = "/stockfish/stockfish-nnue-16-single.wasm";
const READY_TIMEOUT_MS = 15000;
const ANALYZE_TIMEOUT_MS = 45000;

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

type LineWaiter = {
  test: (line: string) => boolean;
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

let latestId: string | null = null;
let latestScore: EngineScore = {};
let engineReady: Promise<EngineInstance> | null = null;
let listenerAttached = false;
let initialized = false;
let analyzeTimer: ReturnType<typeof setTimeout> | null = null;
const lineWaiters: LineWaiter[] = [];

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

const clearAnalyzeTimer = () => {
  if (analyzeTimer) {
    clearTimeout(analyzeTimer);
    analyzeTimer = null;
  }
};

const postToEngine = (sf: EngineInstance, message: string) => {
  if (typeof sf.postMessage !== "function") {
    throw new Error("Stockfish engine postMessage is not available.");
  }
  sf.postMessage(message);
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

const resolveMatchingWaiters = (line: string) => {
  for (let i = lineWaiters.length - 1; i >= 0; i -= 1) {
    const waiter = lineWaiters[i];
    if (!waiter) continue;
    if (!waiter.test(line)) continue;
    clearTimeout(waiter.timer);
    lineWaiters.splice(i, 1);
    waiter.resolve();
  }
};

const handleEngineLine = (event: MessageEvent | string) => {
  const line = typeof event === "string" ? event : event.data;
  if (typeof line !== "string") return;

  resolveMatchingWaiters(line);

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
    clearAnalyzeTimer();
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
    sf.addMessageListener((line) => handleEngineLine(line));
    listenerAttached = true;
    return;
  }
  if ("onmessage" in sf) {
    sf.onmessage = handleEngineLine;
    listenerAttached = true;
    return;
  }
  throw new Error("Stockfish engine has no message listener API.");
};

const waitForLine = (
  test: (line: string) => boolean,
  timeoutMs: number,
  label: string
) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      for (let i = lineWaiters.length - 1; i >= 0; i -= 1) {
        const waiter = lineWaiters[i];
        if (waiter?.timer !== timer) continue;
        lineWaiters.splice(i, 1);
      }
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    lineWaiters.push({
      test,
      resolve,
      reject,
      timer
    });
  });

const initializeEngine = async (sf: EngineInstance) => {
  if (initialized) return;

  postToEngine(sf, "uci");
  await waitForLine((line) => line === "uciok", READY_TIMEOUT_MS, "uciok");

  postToEngine(sf, "isready");
  await waitForLine((line) => line === "readyok", READY_TIMEOUT_MS, "readyok");

  initialized = true;
};

const handleWorkerMessage = async (message: WorkerMessage) => {
  try {
    const sf = await ensureEngine();
    attachMessageListener(sf);
    await initializeEngine(sf);

    if (message.type === "stop") {
      clearAnalyzeTimer();
      postToEngine(sf, "stop");
      latestId = null;
      return;
    }

    latestId = message.id;
    latestScore = {};

    clearAnalyzeTimer();
    analyzeTimer = setTimeout(() => {
      if (!latestId) return;
      const staleId = latestId;
      latestId = null;
      sendError(`Engine analysis timed out on request ${staleId}.`);
      postToEngine(sf, "stop");
    }, ANALYZE_TIMEOUT_MS);

    postToEngine(sf, `position fen ${message.fen}`);
    if (message.movetime && message.movetime > 0) {
      postToEngine(sf, `go movetime ${message.movetime}`);
    } else {
      postToEngine(sf, `go depth ${message.depth ?? 12}`);
    }
  } catch (error) {
    clearAnalyzeTimer();
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
