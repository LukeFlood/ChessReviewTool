const STOCKFISH_SCRIPT_PATH = "/stockfish/stockfish-nnue-16-single.js";
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

type LineWaiter = {
  test: (line: string) => boolean;
  resolve: () => void;
  timer: ReturnType<typeof setTimeout>;
};

let latestId: string | null = null;
let latestScore: EngineScore = {};
let engineReady: Promise<Worker> | null = null;
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

const handleEngineLine = (line: string) => {
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
      timer
    });
  });

const postToEngine = (engine: Worker, message: string) => {
  engine.postMessage(message);
};

const ensureEngine = async () => {
  if (!engineReady) {
    engineReady = new Promise<Worker>((resolve, reject) => {
      try {
        const engine = new Worker(STOCKFISH_SCRIPT_PATH);
        engine.onmessage = (event: MessageEvent) => {
          if (typeof event.data === "string") {
            handleEngineLine(event.data);
          }
        };
        engine.onerror = () => {
          reject(new Error("Nested Stockfish worker failed to initialize."));
        };
        resolve(engine);
      } catch (error) {
        reject(
          new Error(
            error instanceof Error
              ? error.message
              : "Failed to create nested Stockfish worker."
          )
        );
      }
    });
  }
  return engineReady;
};

const initializeEngine = async (engine: Worker) => {
  if (initialized) return;

  postToEngine(engine, "uci");
  await waitForLine((line) => line === "uciok", READY_TIMEOUT_MS, "uciok");

  postToEngine(engine, "isready");
  await waitForLine((line) => line === "readyok", READY_TIMEOUT_MS, "readyok");

  initialized = true;
};

const handleWorkerMessage = async (message: WorkerMessage) => {
  try {
    const engine = await ensureEngine();
    await initializeEngine(engine);

    if (message.type === "stop") {
      clearAnalyzeTimer();
      postToEngine(engine, "stop");
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
      postToEngine(engine, "stop");
    }, ANALYZE_TIMEOUT_MS);

    postToEngine(engine, `position fen ${message.fen}`);
    if (message.movetime && message.movetime > 0) {
      postToEngine(engine, `go movetime ${message.movetime}`);
    } else {
      postToEngine(engine, `go depth ${message.depth ?? 12}`);
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
