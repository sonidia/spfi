<template>
  <div class="default_layout_container">
    <div class="page-content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.page-content {
  max-width: 72rem;
  margin: 0 auto;
  padding: 48px 24px;
}
</style>
