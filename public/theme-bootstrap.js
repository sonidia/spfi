(function () {
  try {
    var key = "spf_theme";
    var stored = localStorage.getItem(key);
    var theme =
      stored === "dark" || stored === "light"
        ? stored
        : window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";

    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (_error) {
    // Storage may be unavailable in hardened browser contexts.
  }
})();
