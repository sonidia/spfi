<template>
  <div class="default_layout_container">
    <div class="page-content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.page-content {
  width: 100%;
  max-width: var(--app-content-max-width);
  margin: 0 auto;
  padding: 48px 24px;
}
</style>
