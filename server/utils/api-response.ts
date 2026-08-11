import type { ApiContractMeta, ApiSuccessResponse } from "~~/types/api-contract";

export function createApiSuccessResponse<TData, TMeta extends ApiContractMeta>(
  data: TData,
  meta: TMeta,
): ApiSuccessResponse<TData, TMeta> {
  return {
    success: true,
    data,
    meta,
  };
}
