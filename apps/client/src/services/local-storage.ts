export function readJson<TValue>(key: string, fallbackValue: TValue): TValue {
  if (typeof window === "undefined") {
    return fallbackValue;
  }

  const rawValue = window.localStorage.getItem(key);
  if (rawValue === null) {
    return fallbackValue;
  }

  try {
    return JSON.parse(rawValue) as TValue;
  } catch {
    return fallbackValue;
  }
}

export function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}
