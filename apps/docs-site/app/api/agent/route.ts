import { generateObject } from "ai";
import { z } from "zod";

// The agent only needs ~a second to pick a route.
export const maxDuration = 20;

const Decision = z.object({
  next: z.enum(["dashboard", "billing", "team"]),
  reason: z
    .string()
    .describe("One short sentence, addressed to the user, explaining the choice."),
});

/**
 * The real-LLM backend for the agentic demo's `LLMAgent`. Disabled by default:
 * a public demo that calls a model on every visit is a cost/abuse hole. Flip it
 * on with `CAIRN_LLM_ENABLED=1` (server) — and add rate-limiting / Vercel BotID
 * before exposing it widely. When off, the client falls back to `SimAgent`.
 */
export async function POST(req: Request): Promise<Response> {
  if (process.env.CAIRN_LLM_ENABLED !== "1") {
    return Response.json({ error: "llm-disabled" }, { status: 503 });
  }

  const { state } = (await req.json()) as { state: unknown };

  // Plain "provider/model" string → routed through the Vercel AI Gateway.
  const { object } = await generateObject({
    model: process.env.CAIRN_AGENT_MODEL ?? "anthropic/claude-haiku-4.5",
    schema: Decision,
    prompt:
      "You guide a user through an onboarding app with three views: dashboard, billing, team. " +
      "Pick the single best next view for this user and explain why in one short sentence.\n" +
      `User state: ${JSON.stringify(state)}\n` +
      "Heuristics: usage at/above 80% → billing (upgrade before they hit the wall); " +
      "otherwise spare seats → team; else dashboard.",
  });

  return Response.json(object);
}
