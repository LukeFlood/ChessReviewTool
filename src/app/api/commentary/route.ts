import { NextResponse } from "next/server";
import {
  commentaryRequestSchema,
  commentaryResponseSchema,
  type CommentaryRequest,
  type CommentaryResponse
} from "@/lib/schemas";

const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const buildFallback = (input: CommentaryRequest): CommentaryResponse => {
  const moveComments = input.moves.map((move) => {
    const scorePart =
      typeof move.evalAfter === "number"
        ? `Eval: ${(move.evalAfter / 100).toFixed(2)}.`
        : move.mateAfter !== null
        ? `Mate score: #${move.mateAfter}.`
        : "";

    const qualityPart =
      move.classification === "best" || move.classification === "excellent"
        ? "Strong practical move."
        : move.classification === "good"
        ? "Reasonable choice, but there may be a sharper continuation."
        : move.classification === "inaccuracy"
        ? "The move concedes some advantage; improve piece activity and tactical checks."
        : move.classification === "mistake"
        ? "This allowed clear counterplay and changed the evaluation."
        : "Critical blunder. Review forcing responses and tactical motifs in this position.";

    const bestMovePart = move.bestMoveBefore
      ? `Engine preferred ${move.bestMoveBefore}.`
      : "";

    return {
      moveIndex: move.moveIndex,
      comment: `${qualityPart} ${bestMovePart} ${scorePart}`.trim()
    };
  });

  return {
    moveComments,
    summary: {
      openingNotes:
        input.keyMoments.biggestSwing ??
        "Opening was mostly balanced; focus on development tempo and central control.",
      middlegameTurningPoint:
        input.keyMoments.firstMistakeWhite ??
        input.keyMoments.firstMistakeBlack ??
        "No single turning point was obvious from engine deltas alone.",
      endgameNotes:
        "Review conversion technique and king activity in simplified positions.",
      trainingPriorities: [
        "Compare your move choices against the engine's best move in critical moments.",
        "Practice tactical scanning before every move: checks, captures, and threats.",
        "Improve strategic planning: identify your worst-placed piece and improve it."
      ]
    }
  };
};

const requestJsonSchema = {
  name: "commentary_response",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      moveComments: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            moveIndex: { type: "integer", minimum: 0 },
            comment: { type: "string" }
          },
          required: ["moveIndex", "comment"]
        }
      },
      summary: {
        type: "object",
        additionalProperties: false,
        properties: {
          openingNotes: { type: "string" },
          middlegameTurningPoint: { type: "string" },
          endgameNotes: { type: "string" },
          trainingPriorities: {
            type: "array",
            minItems: 3,
            maxItems: 3,
            items: { type: "string" }
          }
        },
        required: [
          "openingNotes",
          "middlegameTurningPoint",
          "endgameNotes",
          "trainingPriorities"
        ]
      }
    },
    required: ["moveComments", "summary"]
  }
} as const;

const generateWithLlm = async (
  input: CommentaryRequest
): Promise<CommentaryResponse> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env.local to enable LLM commentary."
    );
  }

  const systemPrompt =
    "You are a chess coach. Explain each move using the engine context. " +
    "For each move comment, include what was good/bad, a tactical or strategic idea, " +
    "and a concrete improvement when relevant. Be concise (1-3 sentences per move). " +
    "Do not invent moves not present in SAN or principal variation. " +
    "Use centipawn/mate data as the primary evidence.";

  const userPrompt = JSON.stringify(
    {
      instructions: {
        moveCommentStyle:
          "One short paragraph per move. Mention move quality and practical idea.",
        summaryStyle:
          "Opening, middlegame turning point, endgame notes, and 3 actionable training priorities.",
        requirement:
          "Return comments for every moveIndex provided. Keep moveComments sorted by moveIndex."
      },
      game: input
    },
    null,
    2
  );

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature: 0.2,
      response_format: {
        type: "json_schema",
        json_schema: requestJsonSchema
      },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${body}`);
  }

  const completion = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = completion.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI response was empty.");
  }

  const parsed = JSON.parse(content) as unknown;
  return commentaryResponseSchema.parse(parsed);
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

  try {
    const llm = await generateWithLlm(parsed.data);
    return NextResponse.json(commentaryResponseSchema.parse(llm));
  } catch (error) {
    const fallback = buildFallback(parsed.data);
    const safeFallback = commentaryResponseSchema.parse(fallback);
    return NextResponse.json(
      {
        ...safeFallback,
        warning:
          error instanceof Error
            ? error.message
            : "LLM commentary failed; using local fallback."
      },
      { status: 200 }
    );
  }
}
