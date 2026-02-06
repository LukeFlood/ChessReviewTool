import { NextResponse } from "next/server";
import {
  commentaryRequestSchema,
  commentaryResponseSchema,
  type CommentaryResponse
} from "@/lib/schemas";

const clampSentence = (text: string) =>
  text.endsWith(".") ? text : `${text}.`;

const summaryFromKeyMoments = (
  biggestSwing?: string,
  firstMistakeWhite?: string,
  firstMistakeBlack?: string
) => {
  return {
    openingNotes:
      biggestSwing ??
      "Opening stayed stable; look for the first spot where the eval drifted.",
    middlegameTurningPoint:
      firstMistakeWhite ??
      firstMistakeBlack ??
      "No clear turning point detected yet.",
    endgameNotes:
      firstMistakeBlack ??
      "Endgame phase was brief; focus on converting small edges.",
    trainingPriorities: [
      "Review the move where the evaluation swung the most.",
      "Practice tactical calculation in critical moments.",
      "Improve conversion technique with rook and pawn endgames."
    ]
  };
};

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = commentaryRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.format() },
      { status: 400 }
    );
  }

  const { moves, keyMoments } = parsed.data;
  const moveComments = moves.map((move) => {
    const base =
      move.classification === "best" || move.classification === "excellent"
        ? "Accurate choice."
        : move.classification === "good"
        ? "Solid move, but there may be a more forcing line."
        : move.classification === "inaccuracy"
        ? "This gave away some of the edge; look for a tighter continuation."
        : move.classification === "mistake"
        ? "This shift opened counterplay; consider the safer resource."
        : "Major swing here; prioritize the tactical refutation next time.";

    const evalNote =
      typeof move.evalAfter === "number"
        ? `Eval after the move: ${(move.evalAfter / 100).toFixed(2)}.`
        : move.mateAfter !== null
        ? `Mate indicator: #${move.mateAfter}.`
        : "";

    const comment = clampSentence(`${base} ${evalNote}`.trim());
    return {
      moveIndex: move.moveIndex,
      comment
    };
  });

  const summary = summaryFromKeyMoments(
    keyMoments.biggestSwing,
    keyMoments.firstMistakeWhite,
    keyMoments.firstMistakeBlack
  );

  const response: CommentaryResponse = {
    moveComments,
    summary
  };

  const validated = commentaryResponseSchema.parse(response);
  return NextResponse.json(validated);
}
