export class StoreStatusInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreStatusInputError";
  }
}
