import { ref } from "vue";
import { getAppErrorMessage } from "~~/utils/error";

export type CsvExportResource = "orders" | "products" | "payments";

export function useDataExport() {
  const isExporting = ref(false);
  const error = ref<string | null>(null);

  async function exportCsv(
    resource: CsvExportResource,
    storeId: string,
    token: string,
    filters: Record<string, unknown> = {},
  ) {
    if (!storeId || !token || isExporting.value) return false;
    isExporting.value = true;
    error.value = null;

    try {
      const response = await $fetch.raw<Blob>(`/api/export/csv/${resource}`, {
        method: "POST",
        body: { storeId, token, filters },
        responseType: "blob",
      });
      if (!response._data) throw new Error("The CSV response was empty.");

      const disposition = response.headers.get("content-disposition") || "";
      const filename =
        disposition.match(/filename="([^"]+)"/i)?.[1] || `${resource}.csv`;
      downloadBlob(response._data, filename);
      return true;
    } catch (cause) {
      error.value = getAppErrorMessage(cause, `Failed to export ${resource}.`);
      return false;
    } finally {
      isExporting.value = false;
    }
  }

  return { error, exportCsv, isExporting };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
