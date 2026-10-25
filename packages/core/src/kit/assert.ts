/** Ends an exhaustive `switch`; a type error here means a case is missing. */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
