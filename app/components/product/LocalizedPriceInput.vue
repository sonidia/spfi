<script setup lang="ts">
defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    modelValue?: string | number | null;
  }>(),
  { modelValue: "" },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

function updateValue(event: Event) {
  emit("update:modelValue", (event.target as HTMLInputElement).value);
}
</script>

<template>
  <input
    v-bind="$attrs"
    :value="props.modelValue ?? ''"
    type="text"
    inputmode="decimal"
    autocomplete="off"
    spellcheck="false"
    @input="updateValue"
  />
</template>
