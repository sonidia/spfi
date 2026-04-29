export const useLoading = () => {
  const loading = useState("global-loading", () => false);
  return { loading };
};
