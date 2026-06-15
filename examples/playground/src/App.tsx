import { useEffect, useMemo, useState } from "react";
import {
  FlowEngine,
  FlowProvider,
  createWebStorageAdapter,
  defineFlow,
  useFlow,
  type CairnEvent,
} from "@cairn/react";

/**
 * Demo flow. `profile` branches on live context: with a team you get the
 * `invite` step, without one the flow completes. This is the behaviour you
 * cannot express in a plain tooltip library.
 */
interface Ctx {
  hasTeam: boolean;
}

const onboarding = defineFlow<Ctx>({
  id: "onboarding",
  initialContext: { hasTeam: false },
  steps: [
    { id: "welcome", next: "search", meta: { target: "#logo", title: "Welcome to Acme 👋", body: "Let's take 30 seconds to find your way around." } },
    { id: "search", next: "profile", meta: { target: "#search", title: "Search anything", body: "Press / anytime to jump here." } },
    { id: "profile", next: (ctx) => (ctx.hasTeam ? "invite" : null), meta: { target: "#profile", title: "Your profile", body: "Manage your account and preferences here." } },
    { id: "invite", next: null, meta: { target: "#invite", title: "Invite your team", body: "You're on a team plan — bring the others in!" } },
  ],
});

export function App() {
  // Build the engine ourselves so we can also tap the raw event stream.
  // Persistence is on: progress survives reloads (try it — advance, then
  // refresh the page; the flow resumes where you left off).
  const engine = useMemo(
    () =>
      new FlowEngine<Ctx>(onboarding, {
        persistence: { adapter: createWebStorageAdapter() },
      }),
    [],
  );
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    return engine.onAny((e: CairnEvent<Ctx>) => {
      const step = e.state.currentStepId ?? "—";
      setLog((prev) => [`${e.type.padEnd(16)} step=${step}`, ...prev].slice(0, 12));
    });
  }, [engine]);

  return (
    <FlowProvider engine={engine}>
      <FakeApp />
      <Tour />
      <EventPanel log={log} onClear={() => setLog([])} />
      <style>{css}</style>
    </FlowProvider>
  );
}

/** A pretend product surface with elements the flow points at. */
function FakeApp() {
  return (
    <div className="app">
      <header>
        <span id="logo" className="logo">▲ Acme</span>
        <input id="search" placeholder="Search…" />
        <button id="invite">Invite</button>
        <div id="profile" className="avatar">TM</div>
      </header>
      <main>
        <h1>Dashboard</h1>
        <p>Open the flow controls (bottom-left) and click <b>Start</b>.</p>
      </main>
    </div>
  );
}

/** The Cairn-driven UI: spotlight + step card + controls. */
function Tour() {
  const { state, start, next, back, skip, setContext, reset } = useFlow<Ctx>();
  const step = state.currentStep;
  const rect = useTargetRect(step?.meta?.target as string | undefined, state.currentStepId);

  return (
    <>
      {/* Spotlight overlay — highlights the target with a cut-out shadow. */}
      {step && rect && (
        <div
          className="spotlight"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
        />
      )}

      {/* Step card, anchored under the target (or centered if no target). */}
      {step && (
        <div
          className="card"
          style={rect ? { top: rect.bottom + 14, left: rect.left } : { top: "40%", left: "50%", transform: "translate(-50%,-50%)" }}
        >
          <div className="card-step">Step {state.stepIndex + 1} / {state.totalSteps}</div>
          <h3>{String(step.meta?.title ?? step.id)}</h3>
          <p>{String(step.meta?.body ?? "")}</p>
          <div className="card-actions">
            <button onClick={back} disabled={state.history.length < 2}>Back</button>
            <button className="primary" onClick={next}>Next</button>
            <button className="ghost" onClick={skip}>Skip</button>
          </div>
        </div>
      )}

      {/* Control dock — drive the flow + flip the branching context live. */}
      <div className="dock">
        <strong>Cairn controls</strong>
        <div className="dock-status">status: <code>{state.status}</code></div>
        <div className="dock-hint">↻ recargá la página: el flujo retoma donde quedó (persistencia)</div>
        <button className="primary" onClick={start}>Start / Resume</button>
        <button onClick={reset}>Reset (limpia persistencia)</button>
        <label className="toggle">
          <input
            type="checkbox"
            checked={state.context.hasTeam}
            onChange={(e) => setContext({ hasTeam: e.target.checked })}
          />
          hasTeam (changes branching → shows “invite” step)
        </label>
      </div>
    </>
  );
}

function EventPanel({ log, onClear }: { log: string[]; onClear: () => void }) {
  return (
    <div className="events">
      <div className="events-head">
        <strong>Event stream</strong>
        <button className="ghost" onClick={onClear}>clear</button>
      </div>
      <pre>{log.length ? log.join("\n") : "(start the flow to see events)"}</pre>
    </div>
  );
}

/** Track a target element's rect, re-measuring on step change / resize / scroll. */
function useTargetRect(selector: string | undefined, stepId: string | null) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }
    const measure = () => {
      const el = document.querySelector(selector);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [selector, stepId]);
  return rect;
}

const css = `
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.5 system-ui, sans-serif; background: #0f1115; color: #e7e9ee; }
  .app header { display: flex; align-items: center; gap: 16px; padding: 14px 20px; background: #171a21; border-bottom: 1px solid #262b36; }
  .logo { font-weight: 700; font-size: 18px; }
  #search { flex: 1; max-width: 360px; padding: 8px 12px; border-radius: 8px; border: 1px solid #2b313d; background: #0f1115; color: #e7e9ee; }
  #invite { padding: 8px 14px; border-radius: 8px; border: 0; background: #2b313d; color: #e7e9ee; cursor: pointer; }
  .avatar { width: 34px; height: 34px; border-radius: 50%; background: #4f46e5; display: grid; place-items: center; font-size: 12px; font-weight: 700; }
  main { padding: 40px; }
  h1 { margin: 0 0 8px; }
  .spotlight { position: fixed; border-radius: 10px; box-shadow: 0 0 0 9999px rgba(8,10,14,.72); transition: all .2s ease; pointer-events: none; z-index: 40; }
  .card { position: fixed; z-index: 50; width: 280px; background: #fff; color: #15171c; border-radius: 12px; padding: 16px; box-shadow: 0 18px 50px rgba(0,0,0,.45); }
  .card-step { font-size: 12px; color: #6b7280; }
  .card h3 { margin: 4px 0 6px; font-size: 16px; }
  .card p { margin: 0 0 14px; font-size: 14px; color: #374151; }
  .card-actions { display: flex; gap: 8px; }
  .card button, .dock button { padding: 7px 12px; border-radius: 8px; border: 1px solid #d1d5db; background: #f3f4f6; color: #111; cursor: pointer; font-size: 13px; }
  .primary { background: #4f46e5 !important; border-color: #4f46e5 !important; color: #fff !important; }
  .ghost { background: transparent !important; border-color: transparent !important; color: #6b7280 !important; }
  .card button:disabled { opacity: .4; cursor: not-allowed; }
  .dock { position: fixed; bottom: 20px; left: 20px; z-index: 60; background: #171a21; border: 1px solid #262b36; border-radius: 12px; padding: 14px; width: 280px; display: flex; flex-direction: column; gap: 10px; }
  .dock-status code { color: #a5b4fc; }
  .dock-hint { font-size: 11px; color: #6b7280; }
  .toggle { font-size: 12px; color: #9aa3b2; display: flex; gap: 8px; align-items: flex-start; }
  .events { position: fixed; bottom: 20px; right: 20px; z-index: 60; width: 340px; background: #0a0c10; border: 1px solid #262b36; border-radius: 12px; padding: 12px; }
  .events-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .events pre { margin: 0; font: 12px/1.5 ui-monospace, monospace; color: #7dd3a0; white-space: pre-wrap; max-height: 200px; overflow: auto; }
`;
