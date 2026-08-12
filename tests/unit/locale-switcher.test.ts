import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LocaleSwitcher from "~/components/LocaleSwitcher.vue";
import { useLocalization } from "~/composables/useLocalization";
import { localeOptions, type LocaleCode } from "~/locales/messages";
import { useLocalizationStore } from "~/stores/localization";

const setupLabels: Record<LocaleCode, string> = {
  en: "Setup",
  vi: "Thiết lập",
  es: "Configuración",
  zh: "设置",
  ja: "セットアップ",
  ar: "الإعداد",
};

describe("LocaleSwitcher", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.stubGlobal("useLocalization", useLocalization);
  });

  it("applies every locale selected from the custom language menu", async () => {
    const wrapper = mount(LocaleSwitcher);
    const localization = useLocalizationStore();

    expect(wrapper.find("select").exists()).toBe(false);

    for (const option of localeOptions) {
      const trigger = wrapper.get(".locale-trigger");
      await trigger.trigger("click");
      await nextTick();

      expect(trigger.attributes("aria-expanded")).toBe("true");
      expect(wrapper.findAll('[role="option"]')).toHaveLength(localeOptions.length);
      await wrapper.get(`[data-locale="${option.code}"]`).trigger("click");

      await vi.waitFor(() => {
        expect(localization.t("nav.setup")).toBe(setupLabels[option.code]);
      });
      await nextTick();

      expect(trigger.attributes("aria-expanded")).toBe("false");
      expect(wrapper.get(".locale-name").text()).toBe(option.nativeLabel);
      expect(localStorage.getItem("spf_locale")).toBe(option.code);
    }

    wrapper.unmount();
  });
});
