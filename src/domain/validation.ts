import { ValidationError } from "./types.js";
export function text(
  value: unknown,
  field: string,
  max: number,
  allowEmpty = false,
): string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (!allowEmpty && !value.trim())
  )
    throw new ValidationError(
      `${field} must be ${allowEmpty ? "text" : "nonblank text"} of at most ${max} characters.`,
    );
  return value.trim();
}
export function object(
  value: unknown,
  keys: string[],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ValidationError("Expected an object.");
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some((key) => !keys.includes(key)))
    throw new ValidationError("Unknown field.");
  return result;
}
export function revision(value: unknown, creation = false): number {
  if (!Number.isSafeInteger(value) || Number(value) < (creation ? 0 : 1))
    throw new ValidationError("Invalid expectedRevision.");
  return Number(value);
}
