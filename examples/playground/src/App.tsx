import { useEffect, useMemo, useState } from "react";
import {
  FlowEngine,
  FlowProvider,
  createWebStorageAdapter,
  defineFlow,
  useFlow,
  type CairnEvent,
} from "cairn-react";
import { CairnPopover, CairnSpotlight } from "cairn-ui";

/**
 * Demo flow. `profile` branches on live context: with a team you get the
 * `invite` step, without one the flow completes.
 */
interface Ctx {
  hasTeam: boolean;
}

const onboarding = defineFlow<Ctx>({
  id: "onboarding",
  initialContext: { hasTeam: false },
  steps: [
    { id: "welcome", next: "search", meta: { target: "#logo", placement: "bottom-start", title: "Welcome to Acme 👋", body: "Let's take 30 seconds to find your way around." } },
    { id: "search", next: "profile", meta: { target: "#search", placement: "bottom", title: "Search anything", body: "Press / anytime to jump here." } },
    { id: "profile", next: (ctx) => (ctx.hasTeam ? "invite" : null), meta: { target: "#profile", placement: "bottom-end", title: "Your profile", body: "Manage your account and preferences here." } },
    { id: "invite", next: null, meta: { target: "#invite", placement: "bottom", title: "Invite your team", body: "You're on a team plan — bring the others in!" } },
  ],
});

export function App() {
  // Build the engine ourselves so we can also tap the raw event stream.
  // Persistence is on: progress survives reloads.
  const engine = useMemo(
    () => new FlowEngine<Ctx>(onboarding, { persistence: { adapter: createWebStorageAdapter() } }),
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

      {/* The entire guided UI is now two components from cairn-ui. */}
      <CairnSpotlight padding={6} />
      {/* Don't dismiss/trap on outside interaction — the dock toggles (e.g.
          hasTeam) live outside the popover and should drive the flow, not end it. */}
      <CairnPopover className="cairn-card" trapFocus={false} dismissOnInteractOutside={false}>
        {(step) => <StepCard title={String(step.meta?.title)} body={String(step.meta?.body ?? "")} />}
      </CairnPopover>

      <Dock />
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

/** Popover content — you own the UI; Cairn owns positioning + a11y. */
function StepCard({ title, body }: { title: string; body: string }) {
  const { state, next, back, skip } = useFlow<Ctx>();
  return (
    <>
      <div className="card-step">Step {state.stepIndex + 1} / {state.totalSteps}</div>
      <h3>{title}</h3>
      <p>{body}</p>
      <div className="card-actions">
        <button onClick={back} disabled={state.history.length < 2}>Back</button>
        <button className="primary" onClick={next}>Next</button>
        <button className="ghost" onClick={skip}>Skip</button>
      </div>
    </>
  );
}

/** Control dock — drive the flow + flip the branching context live. */
function Dock() {
  const { state, start, reset, setContext } = useFlow<Ctx>();
  return (
    <div className="dock">
      <strong>Cairn controls</strong>
      <div className="dock-status">status: <code>{state.status}</code></div>
      <div className="dock-hint">↻ recargá la página: el flujo retoma donde quedó (persistencia)</div>
      <button className="primary" onClick={start}>Start / Resume</button>
      <button onClick={reset}>Reset (limpia persistencia)</button>
      <label className="toggle">
        <input type="checkbox" checked={state.context.hasTeam} onChange={(e) => setContext({ hasTeam: e.target.checked })} />
        hasTeam (changes branching → shows "invite" step)
      </label>
    </div>
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
  /* Style the cairn-ui popover via its data/class hook — you keep full control. */
  .cairn-card { width: 280px; background: #fff; color: #15171c; border-radius: 12px; padding: 16px; box-shadow: 0 18px 50px rgba(0,0,0,.45); }
  .cairn-card [data-cairn-arrow] { fill: #fff; }
  .card-step { font-size: 12px; color: #6b7280; }
  .cairn-card h3 { margin: 4px 0 6px; font-size: 16px; }
  .cairn-card p { margin: 0 0 14px; font-size: 14px; color: #374151; }
  .card-actions { display: flex; gap: 8px; }
  .card-actions button, .dock button { padding: 7px 12px; border-radius: 8px; border: 1px solid #d1d5db; background: #f3f4f6; color: #111; cursor: pointer; font-size: 13px; }
  .primary { background: #4f46e5 !important; border-color: #4f46e5 !important; color: #fff !important; }
  .ghost { background: transparent !important; border-color: transparent !important; color: #6b7280 !important; }
  .card-actions button:disabled { opacity: .4; cursor: not-allowed; }
  .dock { position: fixed; bottom: 20px; left: 20px; z-index: 60; background: #171a21; border: 1px solid #262b36; border-radius: 12px; padding: 14px; width: 280px; display: flex; flex-direction: column; gap: 10px; }
  .dock-status code { color: #a5b4fc; }
  .dock-hint { font-size: 11px; color: #6b7280; }
  .toggle { font-size: 12px; color: #9aa3b2; display: flex; gap: 8px; align-items: flex-start; }
  .events { position: fixed; bottom: 20px; right: 20px; z-index: 60; width: 340px; background: #0a0c10; border: 1px solid #262b36; border-radius: 12px; padding: 12px; }
  .events-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .events pre { margin: 0; font: 12px/1.5 ui-monospace, monospace; color: #7dd3a0; white-space: pre-wrap; max-height: 200px; overflow: auto; }
`;
