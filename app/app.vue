<script lang="ts" setup>
import Nav from "./components/Nav.vue";
</script>

<template>
  <main class="app-root">
    <Nav />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
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
  --text: #202223;
  --text-sub: #6d7175;
  --text-link: #2c6ecb;
  --badge-paid: #e4f2e8;
  --badge-paid-text: #1a7f37;
  --badge-fulfilled: #e0f0ff;
  --badge-fulfilled-text: #0077cc;
  --badge-archived: #f1f2f4;
  --badge-archived-text: #6d7175;
  --badge-cancelled: #fce8e8;
  --badge-cancelled-text: #c0392b;
  --badge-pending: #fff3cd;
  --badge-pending-text: #856404;
  --radius: 8px;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 1px rgba(0, 0, 0, 0.03);
  --text-primary: #1a1a1a;
  --text-secondary: #6d6d6d;
  --text-muted: #9e9e9e;
  --green-bg: #e3f1ed;
  --blue: #005bd3;
  --red: #d72c0d;
  --radius-sm: 8px;
  --font: ;
  --bg: #f1f1f1;
  --surface: #ffffff;
  --border: #e3e3e3;
  --green: #008060;
}

html,
body {
  font-family:
    "Inter",
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
  background: var(--bg);
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.5;
  min-height: 100vh;
}

a {
  text-decoration: none;
}

select {
  outline: none;
}

.app-root {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text-primary);
  min-height: 100vh;
}

.layout,
.page {
  max-width: 900px;
  margin: 0 auto;
}
</style>
