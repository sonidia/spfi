import { isRef, ref, type Ref } from "vue";

export function useGoogleSheet(url: string | Ref<string>) {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const headers = ref<string[]>([]);
  const rows = ref<string[][]>([]);
  const filteredRows = ref<string[][]>([]);

  const cleanCell = (value: any) => {
    if (value == null) return "";
    return String(value).trim().replace(/\s+/g, " ");
  };

  const load = async () => {
    loading.value = true;
    error.value = null;

    try {
      const resolvedUrl = isRef(url) ? url.value : url;

      const res = await fetch(resolvedUrl);
      if (!res.ok) throw new Error(`Không thể tải sheet (HTTP ${res.status})`);

      const text = await res.text();

      // STRICT CLIENT-ONLY IMPORT:
      // Ensure PapaParse is only ever touched on the client side.
      // nitro.externals and the Vite plugin in nuxt.config.ts handle the build-time protection.
      if (import.meta.client) {
        const Papa = (await import("papaparse")).default;
        const parsed = Papa.parse<string[]>(text, {
          skipEmptyLines: true,
        });

        const data = parsed.data as string[][];

        if (!data.length) throw new Error("Sheet trống hoặc không có dữ liệu");

        headers.value = data[0] || [];
        rows.value = data.slice(1).map((row) => row.map(cleanCell));
        filteredRows.value = rows.value;
      }
    } catch (e: any) {
      error.value = e.message || "Unknown error";
    } finally {
      loading.value = false;
    }
  };

  return {
    loading,
    error,
    headers,
    rows,
    filteredRows,
    load,
  };
}
