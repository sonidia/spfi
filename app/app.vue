<script lang="ts" setup>
import AppFooter from "./components/AppFooter.vue";
import BaseToast from "./components/BaseToast.vue";
import LoadingOverlay from "./components/LoadingOverlay.vue";
import Nav from "./components/Nav.vue";
import { useLoading } from "./composables/useLoading";
import { useTokenRotation } from "./composables/useTokenRotation";

const { loading } = useLoading();
useTokenRotation();
</script>

<template>
  <main class="app-root">
    <LoadingOverlay :visible="loading" />
    <BaseToast />
    <Nav />
    <NuxtLayout>
      <NuxtPage :keepalive="{ max: 12 }" />
    </NuxtLayout>
    <AppFooter />
  </main>
</template>

<style>
@import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap");

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  color-scheme: light;
  --footer-height: 36px;
  --bg: #f5f7f4;
  --surface: #ffffff;
  --surface-soft: #eef4f0;
  --text: #14221b;
  --text-sub: #65756c;
  --text-link: #275c91;
  --muted: #65756c;
  --line: #d9e4dd;
  --border: #d9e4dd;
  --green: #1f7a4d;
  --green-soft: #dff4e8;
  --green-bg: #dff4e8;
  --blue: #275c91;
  --blue-soft: #e2eef9;
  --amber: #9b6416;
  --amber-soft: #fff0d5;
  --red: #b4312b;
  --red-soft: #ffe2df;
  --shadow: 0 20px 60px rgba(20, 34, 27, 0.1);
  --badge-paid: #dff4e8;
  --badge-paid-text: #1f7a4d;
  --badge-paid-border: #1f7a4d40;
  --badge-fulfilled: #e0f0ff;
  --badge-fulfilled-text: #275c91;
  --badge-fulfilled-border: #275c9140;
  --badge-archived: #f1f2f4;
  --badge-archived-text: #6d7175;
  --badge-cancelled: #ffe2df;
  --badge-cancelled-text: #b4312b;
  --badge-pending: #fff0d5;
  --badge-pending-text: #9b6416;
  --radius: 8px;
  --radius-sm: 8px;
  --font:
    "DM Sans", Inter, ui-sans-serif, system-ui, -apple-system,
    BlinkMacSystemFont, "Segoe UI", sans-serif;
  --text-primary: var(--text);
  --text-secondary: var(--muted);
  --text-muted: #8b9991;
}

html,
body {
  font-family:
    "DM Sans",
    Inter,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.5;
  min-height: 100vh;
  background:
    linear-gradient(
      180deg,
      rgba(231, 239, 234, 0.9),
      rgba(245, 247, 244, 0) 320px
    ),
    var(--bg);
}

a {
  text-decoration: none;
}

select,
input,
textarea {
  outline: none;
}

* {
  scrollbar-width: thin;
  scrollbar-color: rgba(31, 122, 77, 0.45) rgba(217, 228, 221, 0.45);
}

*::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

*::-webkit-scrollbar-track {
  background: rgba(217, 228, 221, 0.38);
  border-radius: 999px;
}

*::-webkit-scrollbar-thumb {
  border: 2px solid rgba(245, 247, 244, 0.9);
  border-radius: 999px;
  background: linear-gradient(
    180deg,
    rgba(31, 122, 77, 0.72),
    rgba(39, 92, 145, 0.66)
  );
}

*::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(
    180deg,
    rgba(31, 122, 77, 0.88),
    rgba(39, 92, 145, 0.82)
  );
}

*::-webkit-scrollbar-corner {
  background: transparent;
}

.app-root {
  font-family: var(--font);
  color: var(--text-primary);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.layout,
.page {
  max-width: 1028px;
  min-width: 100%;
  margin: 0 auto;
}
</style>
