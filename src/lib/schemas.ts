import { z } from "zod";

export const moveAnalysisSchema = z.object({
  moveIndex: z.number().int().min(0),
  san: z.string(),
  evalBefore: z.number().nullable(),
  evalAfter: z.number().nullable(),
  mateBefore: z.number().nullable(),
  mateAfter: z.number().nullable(),
  cpl: z.number().nonnegative(),
  classification: z.enum([
    "best",
    "excellent",
    "good",
    "inaccuracy",
    "mistake",
    "blunder"
  ])
});

export const commentaryRequestSchema = z.object({
  metadata: z.object({
    Event: z.string().optional(),
    White: z.string().optional(),
    Black: z.string().optional(),
    Result: z.string().optional(),
    ECO: z.string().optional()
  }),
  moves: z.array(moveAnalysisSchema),
  keyMoments: z.object({
    biggestSwing: z.string().optional(),
    firstMistakeWhite: z.string().optional(),
    firstMistakeBlack: z.string().optional(),
    missedTactics: z.array(z.string())
  })
});

export const commentaryResponseSchema = z.object({
  moveComments: z.array(
    z.object({
      moveIndex: z.number().int().min(0),
      comment: z.string()
    })
  ),
  summary: z.object({
    openingNotes: z.string(),
    middlegameTurningPoint: z.string(),
    endgameNotes: z.string(),
    trainingPriorities: z.array(z.string()).length(3)
  })
});

export type CommentaryRequest = z.infer<typeof commentaryRequestSchema>;
export type CommentaryResponse = z.infer<typeof commentaryResponseSchema>;
export type MoveAnalysis = z.infer<typeof moveAnalysisSchema>;
