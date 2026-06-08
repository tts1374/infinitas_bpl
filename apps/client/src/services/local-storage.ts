import { buildScopedStorageKey } from "../runtime/runtime-config";

export type JsonReadResult<TValue> =
  | { status: "value"; value: TValue }
  | { status: "missing" | "malformed" };

export function readJson<TValue>(key: string, fallbackValue: TValue): TValue {
  const result = readJsonResult<TValue>(key);
  return result.status === "value" ? result.value : fallbackValue;
}

export function readJsonResult<TValue>(key: string): JsonReadResult<TValue> {
  if (typeof window === "undefined") {
    return { status: "missing" };
  }

  const rawValue = window.localStorage.getItem(buildScopedStorageKey(key));
  if (rawValue === null) {
    return { status: "missing" };
  }

  try {
    return { status: "value", value: JSON.parse(rawValue) as TValue };
  } catch {
    return { status: "malformed" };
  }
}

export function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(buildScopedStorageKey(key), JSON.stringify(value));
}
