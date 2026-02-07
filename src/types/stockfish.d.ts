declare module "stockfish/src/stockfish-nnue-16-single.js" {
  type EngineInstance = {
    postMessage: (command: string) => void;
    onmessage: ((event: MessageEvent | string) => void) | null;
  };

  const Stockfish: (options?: {
    locateFile?: (path: string) => string;
  }) => EngineInstance;
  export default Stockfish;
}
