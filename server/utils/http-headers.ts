interface HeaderBag {
  get?: (name: string) => unknown;
  [name: string]: unknown;
}

export function getAxiosHeaderValue(headers: unknown, name: string) {
  const headerBag = (headers || {}) as HeaderBag;
  if (typeof headerBag.get === "function") {
    return headerBag.get(name);
  }

  return headerBag[name] ?? headerBag[name.toLowerCase()];
}
