import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { provideFlow, useFlow, defineFlow, type FlowEngine } from "./index.js";

interface Ctx {
  hasTeam: boolean;
}

const flow = defineFlow<Ctx>({
  id: "t",
  initialContext: { hasTeam: false },
  steps: [
    { id: "a", next: "b" },
    { id: "b", next: (c) => (c.hasTeam ? "c" : null) },
    { id: "c", next: null },
  ],
});

const Child = defineComponent({
  setup() {
    return { flow: useFlow<Ctx>() };
  },
  render() {
    return h("div", [
      h("span", { class: "step" }, this.flow.state.value.currentStepId ?? "none"),
      h("span", { class: "status" }, this.flow.state.value.status),
    ]);
  },
});

function mountFlow() {
  let engine!: FlowEngine<Ctx>;
  const Parent = defineComponent({
    setup() {
      engine = provideFlow<Ctx>(flow, { autoStart: true });
    },
    render: () => h(Child),
  });
  const wrapper = mount(Parent);
  return { wrapper, engine };
}

describe("cairn-vue", () => {
  it("starts on the first step", () => {
    const { wrapper } = mountFlow();
    expect(wrapper.find(".step").text()).toBe("a");
    expect(wrapper.find(".status").text()).toBe("active");
  });

  it("re-renders reactively on transitions", async () => {
    const { wrapper, engine } = mountFlow();
    engine.next();
    await nextTick();
    expect(wrapper.find(".step").text()).toBe("b");
  });

  it("reflects branching driven from context", async () => {
    const { wrapper, engine } = mountFlow();
    engine.setContext({ hasTeam: true });
    engine.next(); // a → b
    engine.next(); // b → c (team)
    await nextTick();
    expect(wrapper.find(".step").text()).toBe("c");
  });

  it("completes the no-team branch", async () => {
    const { wrapper, engine } = mountFlow();
    engine.next(); // b
    engine.next(); // null → complete
    await nextTick();
    expect(wrapper.find(".status").text()).toBe("completed");
    expect(wrapper.find(".step").text()).toBe("none");
  });

  it("throws when useFlow is used without provideFlow", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => mount(Child)).toThrow(/provideFlow/);
    spy.mockRestore();
  });

  it("destroys an owned engine on unmount", () => {
    const { wrapper, engine } = mountFlow();
    const destroy = vi.spyOn(engine, "destroy");
    wrapper.unmount();
    expect(destroy).toHaveBeenCalled();
  });
});
