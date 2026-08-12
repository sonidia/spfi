export type ApiRetrievalStrategy = "cursor" | "complete" | "aggregate";

export type ApiFieldConvention = "shopify-rest" | "app-camel-case";

export interface ApiContractMeta<
  TResource extends string = string,
  TStrategy extends ApiRetrievalStrategy = ApiRetrievalStrategy,
> {
  resource: TResource;
  strategy: TStrategy;
  fieldConvention: ApiFieldConvention;
}

export type ApiSuccessResponse<
  TData,
  TMeta extends ApiContractMeta = ApiContractMeta,
> = {
  success: true;
  data: TData;
  meta: TMeta;
};
