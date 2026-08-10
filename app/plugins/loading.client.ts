export default defineNuxtPlugin(() => {
  const { loading } = useLoading();
  const router = useRouter();
 
  router.beforeEach(() => {
    loading.value = true;
  });
 
  router.afterEach(() => {
    setTimeout(() => {
      loading.value = false;
    }, 150);
  });
 
  router.onError(() => {
    loading.value = false;
  });
});
