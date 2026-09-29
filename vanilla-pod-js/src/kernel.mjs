/**
 * Fetcher kernel for object-shaped API responses (the RealWorld API returns
 * one JSON object per request, not an NDJSON line stream).
 *
 * Fail-closed policy: the assembled response is validated before use; the
 * first invalid body throws with its diagnostics. The kernel never returns
 * unvalidated data and never coerces.
 * The "endpoint" is the injected fetchAssembly — this module contains no
 * transport or endpoint-implementation code.
 */
import { structuralFreeze } from "./structural-freeze.mjs";

/**
 * @typedef {{instancePath: string, schemaPath: string}} ValidationError
 * @typedef {(instance: any) => ValidationError[]} Validator
 * @typedef {{name: string, validate: Validator}} KernelConfig
 * @typedef {{info: (message: string, meta?: Record<string, unknown>) => void, warn: (message: string, meta?: Record<string, unknown>) => void}} Observability
 * @typedef {Record<string, unknown>} KernelCtx
 * @typedef {(config: KernelConfig, ctx: KernelCtx | null, input: unknown) => Promise<unknown> | unknown} FetchAssembly
 */

/** Error thrown by the kernel when a response fails; carries the diagnostics. */
export class KernelObjectError extends Error {
  /**
   * @param {string} schemaName
   * @param {string} reason
   * @param {unknown} [instance]
   */
  constructor(schemaName, reason, instance) {
    super(`[${schemaName}] ${reason}`);
    this.name = "KernelObjectError";
    this.schemaName = schemaName;
    this.reason = reason;
    this.instance = instance;
  }
}

/**
 * @param {KernelConfig} config
 * @param {Observability} obs
 * @param {FetchAssembly} fetchAssembly
 * @param {KernelCtx | null} ctx
 * @param {unknown} input
 * @returns {Promise<Readonly<Record<string, unknown>>>}
 */
export async function objectKernel(config, obs, fetchAssembly, ctx, input) {
  const instance = await fetchAssembly(config, ctx, input);
  if (instance === null || typeof instance !== "object" || Array.isArray(instance)) {
    throw new KernelObjectError(config.name, "response is not a JSON object", instance);
  }
  const errors = config.validate(instance);
  if (errors.length > 0) {
    throw new KernelObjectError(config.name, `validation failed ${JSON.stringify(errors)}`, instance);
  }
  obs.info("accepted response", { schema: config.name });
  return structuralFreeze(/** @type {Record<string, unknown>} */ (instance));
}
