import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import RateLimitQuota from "~/components/shop/RateLimitQuota.vue";
import { useRateLimitStore } from "~/stores/rateLimit";

describe("rate limit store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("uses the stable app-wide API quota headers", () => {
    const store = useRateLimitStore();
    const headers = new Headers({
      "x-ratelimit-limit": "30",
      "x-ratelimit-remaining": "20",
      "x-ratelimit-reset": "100",
      "x-ratelimit-api-limit": "600",
      "x-ratelimit-api-remaining": "599",
      "x-ratelimit-api-reset": "100",
    });

    expect(store.updateFromHeaders(headers, 1_000)).toBe(true);
    expect(store.limit).toBe(600);
    expect(store.remaining).toBe(599);
    expect(store.resetAt).toBe(100_000);
    expect(store.lastUpdatedAt).toBe(1_000);
  });

  it("does not let out-of-order responses increase quota in one window", () => {
    const store = useRateLimitStore();

    store.updateFromHeaders(rateHeaders(600, 598, 100), 1_000);
    store.updateFromHeaders(rateHeaders(600, 599, 100), 2_000);

    expect(store.remaining).toBe(598);
    expect(store.lastUpdatedAt).toBe(1_000);
  });

  it("accepts a new window and ignores a late response from the old one", () => {
    const store = useRateLimitStore();

    store.updateFromHeaders(rateHeaders(600, 1, 100), 1_000);
    store.updateFromHeaders(rateHeaders(600, 599, 160), 2_000);
    store.updateFromHeaders(rateHeaders(600, 0, 100), 3_000);

    expect(store.remaining).toBe(599);
    expect(store.resetAt).toBe(160_000);
    expect(store.lastUpdatedAt).toBe(2_000);
  });

  it("ignores incomplete or invalid headers", () => {
    const store = useRateLimitStore();

    expect(store.updateFromHeaders(new Headers())).toBe(false);
    expect(store.updateFromHeaders(rateHeaders(0, 0, 0))).toBe(false);
    expect(store.isKnown).toBe(false);
  });

  it("renders a horizontal meter when expanded and a circumference ring when collapsed", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useRateLimitStore();
    store.updateFromHeaders(rateHeaders(600, 300, futureReset()), 1_000);

    const wrapper = mount(RateLimitQuota, {
      props: { collapsed: false },
      global: { plugins: [pinia] },
    });

    expect(wrapper.text()).toContain("300 / 600 requests");
    expect(wrapper.text()).toContain("50%");
    expect(wrapper.get(".quota-progress span").attributes("style")).toContain(
      "width: 50%",
    );

    await wrapper.setProps({ collapsed: true });

    const ring = wrapper.get(".quota-ring-value");
    const circumference = 2 * Math.PI * 17;
    expect(Number(ring.attributes("stroke-dashoffset"))).toBeCloseTo(circumference / 2);
    expect(wrapper.get(".quota-ring").text()).toBe("50");

    wrapper.unmount();
  });
});

function rateHeaders(limit: number, remaining: number, reset: number) {
  return new Headers({
    "x-ratelimit-api-limit": String(limit),
    "x-ratelimit-api-remaining": String(remaining),
    "x-ratelimit-api-reset": String(reset),
  });
}

function futureReset() {
  return Math.ceil(Date.now() / 1_000) + 60;
}
