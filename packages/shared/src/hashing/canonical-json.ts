type JsonPrimitive = boolean | null | number | string;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function normalize(value: unknown, path: string): JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`non-finite number at ${path}`);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => normalize(item, `${path}[${index}]`));
  }

  if (typeof value === "object") {
    const output: { [key: string]: JsonValue } = {};
    for (const key of Object.keys(value).sort()) {
      const child = (value as Record<string, unknown>)[key];
      if (child === undefined) {
        throw new TypeError(`undefined value at ${path}.${key}`);
      }
      output[key] = normalize(child, `${path}.${key}`);
    }
    return output;
  }

  throw new TypeError(`unsupported JSON value at ${path}`);
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value, "$"));
}
