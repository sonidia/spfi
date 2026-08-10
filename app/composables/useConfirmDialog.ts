import { readonly, ref } from "vue";

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

const options = ref<ConfirmDialogOptions | null>(null);
let resolveActive: ((confirmed: boolean) => void) | null = null;

export function useConfirmDialog() {
  function requestConfirmation(nextOptions: ConfirmDialogOptions) {
    if (resolveActive) resolveActive(false);
    options.value = nextOptions;

    return new Promise<boolean>((resolve) => {
      resolveActive = resolve;
    });
  }

  function resolveConfirmation(confirmed: boolean) {
    const resolve = resolveActive;
    resolveActive = null;
    options.value = null;
    resolve?.(confirmed);
  }

  return {
    options: readonly(options),
    requestConfirmation,
    resolveConfirmation,
  };
}
