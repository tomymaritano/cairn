import type { FlowContext, FlowDefinition } from "./types.js";

/**
 * Identity helper that pins the context type so `next`/`canEnter` callbacks
 * get full inference without restating generics. Purely a DX nicety —
 * it returns the definition untouched.
 *
 * @example
 * const onboarding = defineFlow<{ hasTeam: boolean }>({
 *   id: "onboarding",
 *   steps: [
 *     { id: "welcome", next: "profile", meta: { target: "#logo" } },
 *     { id: "profile", next: (ctx) => (ctx.hasTeam ? "invite" : null) },
 *     { id: "invite", next: null },
 *   ],
 * });
 */
export function defineFlow<C extends object = FlowContext>(
  definition: FlowDefinition<C>,
): FlowDefinition<C> {
  return definition;
}
