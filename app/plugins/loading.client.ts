export default defineNuxtPlugin((nuxtApp) => {
  const { loading } = useLoading();

  nuxtApp.hook("app:page:start", () => {
    loading.value = true;
  });

  nuxtApp.hook("app:page:finish", () => {
    setTimeout(() => {
      loading.value = false;
    }, 200);
  });

  // Fallback for errors
  nuxtApp.hook("vue:error", () => {
    loading.value = false;
  });
});
