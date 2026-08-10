import { onScopeDispose, watch, type WatchSource } from "vue";

export function useDebouncedWatch<T>(
  source: WatchSource<T>,
  callback: (value: T) => unknown,
  delay = 300,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const stop = watch(source, (value) => {
    clearTimeout(timer);
    timer = setTimeout(() => void callback(value), Math.max(0, delay));
  });

  function cancel() {
    clearTimeout(timer);
    timer = undefined;
  }

  onScopeDispose(() => {
    cancel();
    stop();
  });

  return { cancel };
}
