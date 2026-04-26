import { z } from "zod";

export const actionTypeValues = [
  "MOVE",
  "SPEAK",
  "ATTACK",
  "DEFEND",
  "DISCOVER",
  "INTERACT",
  "EMOTIONAL_CHANGE",
  "STATE_CHANGE",
  "ALLIANCE_CHANGE",
  "ITEM_CHANGE",
] as const;

export const actionTypeSchema = z.enum(actionTypeValues);

export const extractEventsRequestSchema = z
  .object({
    story: z.string().trim().min(1),
    metadata: z
      .object({
        storyId: z.string().trim().min(1).optional(),
        usePronounResolver: z.boolean().optional(),
      })
      .optional(),
  })
  .strict();

export const llmEventSchema = z
  .object({
    action: actionTypeSchema,
    actors: z.array(z.string().trim().min(1)).min(1),
    targets: z.array(z.string().trim().min(1)).optional(),
    location: z.string().trim().min(1).optional(),
    timeHint: z.string().trim().min(1).optional(),
    sourceText: z.string().trim().min(1),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export const eventSchema = llmEventSchema.extend({
  eventId: z.string().uuid(),
});

export const usageSchema = z
  .object({
    promptTokens: z.number().int().nonnegative(),
    completionTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
  })
  .strict();

export const extractEventsResponseSchema = z
  .object({
    events: z.array(eventSchema),
    model: z.string().trim().min(1),
    usage: usageSchema.optional(),
    warnings: z.array(z.string().trim().min(1)).optional(),
    requestId: z.string().uuid(),
  })
  .strict();

export const errorCodeValues = [
  "INVALID_REQUEST",
  "EXTRACTION_FAILED",
  "PROVIDER_ERROR",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
] as const;

export const errorCodeSchema = z.enum(errorCodeValues);

export const errorResponseSchema = z
  .object({
    error: z
      .object({
        code: errorCodeSchema,
        message: z.string().trim().min(1),
        details: z.unknown().optional(),
      })
      .strict(),
    requestId: z.string().uuid(),
  })
  .strict();

export type ActionType = z.infer<typeof actionTypeSchema>;
export type Event = z.infer<typeof eventSchema>;
export type ExtractEventsRequest = z.infer<typeof extractEventsRequestSchema>;
export type ExtractEventsResponse = z.infer<typeof extractEventsResponseSchema>;
export type ErrorCode = z.infer<typeof errorCodeSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
