import { defineStore } from "pinia";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration?: number;
}

export const useToastStore = defineStore("toast", {
  state: () => ({
    toasts: [] as Toast[],
  }),
  actions: {
    addToast(message: string, type: ToastType = "info", duration = 3000) {
      const id = Date.now();
      this.toasts.push({ id, message, type, duration });
      
      if (duration > 0) {
        setTimeout(() => {
          this.removeToast(id);
        }, duration);
      }
    },
    removeToast(id: number) {
      this.toasts = this.toasts.filter((t) => t.id !== id);
    },
    success(message: string, duration?: number) {
      this.addToast(message, "success", duration);
    },
    error(message: string, duration?: number) {
      this.addToast(message, "error", duration);
    },
    info(message: string, duration?: number) {
      this.addToast(message, "info", duration);
    },
    warning(message: string, duration?: number) {
      this.addToast(message, "warning", duration);
    },
  },
});
