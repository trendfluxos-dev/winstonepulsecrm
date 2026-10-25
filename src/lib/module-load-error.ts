/** Browser import failures are recoverable after a deployment/editor revision. */
export const MODULE_LOAD_ERROR_PATTERN = /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|ChunkLoadError|undefined is not an object \(evaluating ['"][\w$]+\[[\w$]+\?\?`default`\]['"]\)/i;

export function isModuleLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return MODULE_LOAD_ERROR_PATTERN.test(message);
}