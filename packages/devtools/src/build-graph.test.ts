import { describe, expect, it } from "vitest";
import { defineFlow } from "cairn-core";
import { buildGraph } from "./build-graph.js";

interface Ctx {
  plan: "free" | "team";
}

describe("buildGraph", () => {
  it("draws solid edges for string `next` and marks start/end", () => {
    const g = buildGraph(
      defineFlow<Ctx>({
        id: "f",
        initialContext: { plan: "free" },
        steps: [
          { id: "a", next: "b" },
          { id: "b", next: null },
        ],
      }),
    );
    expect(g.nodes.map((n) => n.id)).toEqual(["a", "b"]);
    expect(g.nodes[0]!.badges).toContain("start");
    expect(g.nodes[1]!.badges).toContain("end");
    expect(g.edges).toEqual([{ id: "a:next:b", from: "a", to: "b", kind: "next" }]);
    expect(g.dynamic).toEqual([]);
  });

  it("marks function `next` as dynamic with no solid edge", () => {
    const g = buildGraph(
      defineFlow<Ctx>({
        id: "f",
        initialContext: { plan: "free" },
        steps: [
          { id: "decide", next: (c) => (c.plan === "team" ? "x" : "y") },
          { id: "x", next: null },
          { id: "y", next: null },
        ],
      }),
    );
    expect(g.dynamic).toContain("decide");
    expect(g.nodes[0]!.badges).toContain("dynamic");
    expect(g.edges.filter((e) => e.from === "decide")).toEqual([]);
  });

  it("draws dotted `possible` edges from meta.targets on a dynamic step", () => {
    const g = buildGraph(
      defineFlow<Ctx>({
        id: "f",
        initialContext: { plan: "free" },
        steps: [
          { id: "decide", next: (c) => (c.plan === "team" ? "x" : "y"), meta: { targets: ["x", "y"] } },
          { id: "x", next: null },
          { id: "y", next: null },
        ],
      }),
    );
    const possible = g.edges.filter((e) => e.kind === "possible").map((e) => e.to);
    expect(possible.sort((a, b) => a.localeCompare(b))).toEqual(["x", "y"]);
  });

  it("draws a dashed `error` edge for string onError", () => {
    const g = buildGraph(
      defineFlow<Ctx>({
        id: "f",
        initialContext: { plan: "free" },
        steps: [
          { id: "run", next: "ok", onError: "fail" },
          { id: "ok", next: null },
          { id: "fail", next: null },
        ],
      }),
    );
    expect(g.edges).toContainEqual({ id: "run:error:fail", from: "run", to: "fail", kind: "error" });
  });

  it("badges async (`run`) and guarded (`canEnter`) steps", () => {
    const g = buildGraph(
      defineFlow<Ctx>({
        id: "f",
        initialContext: { plan: "free" },
        steps: [
          { id: "fetch", run: async () => ({}), next: "gate" },
          { id: "gate", canEnter: () => true, next: null },
        ],
      }),
    );
    expect(g.nodes.find((n) => n.id === "fetch")!.badges).toContain("async");
    expect(g.nodes.find((n) => n.id === "gate")!.badges).toContain("guarded");
  });

  it("drops edges pointing at unknown steps (broken `next`)", () => {
    const g = buildGraph(
      defineFlow<Ctx>({
        id: "f",
        initialContext: { plan: "free" },
        steps: [{ id: "a", next: "ghost" }],
      }),
    );
    expect(g.edges).toEqual([]);
  });
});
