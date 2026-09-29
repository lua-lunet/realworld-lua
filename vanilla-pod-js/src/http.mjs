/**
 * Typed fetch adapters. Each adapter acquires one JSON body and fails closed
 * on transport errors and non-2xx status; shape checking belongs to the
 * kernel's validator, not here.
 * @typedef {{status: number, statusText: string, body: string}} HttpFailure
 */

/**
 * @param {string} url
 * @param {string} method
 * @param {{token?: string, body?: unknown}} [options]
 * @returns {Promise<unknown>}
 */
async function jsonFetch(url, method, options = {}) {
  /** @type {Record<string, string>} */
  const headers = { "accept": "application/json" };
  if (options.token) headers["authorization"] = `Token ${options.token}`;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(url, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (!response.ok) {
    /** @type {string} */
    let detail = "";
    try {
      const body = /** @type {any} */ (await response.json());
      if (body && typeof body === "object" && "errors" in body) {
        detail = Object.values(/** @type {Record<string, string[]>} */ (body.errors))
          .flatMap((messages) => messages)
          .join("; ");
      }
    } catch {
      detail = "";
    }
    throw new Error(
      `[${method} ${url}] HTTP ${response.status} ${response.statusText}${detail === "" ? "" : `: ${detail}`}`,
    );
  }
  const text = await response.text();
  if (text.trim() === "") return null;
  return JSON.parse(text);
}

/**
 * @param {string} url
 * @param {string} [token]
 * @returns {Promise<unknown>}
 */
export function httpGetJson(url, token) {
  return jsonFetch(url, "GET", { token });
}

/**
 * @param {string} url
 * @param {unknown} body
 * @param {string} [token]
 * @returns {Promise<unknown>}
 */
export function httpPostJson(url, body, token) {
  return jsonFetch(url, "POST", { body, token });
}

/**
 * @param {string} url
 * @param {unknown} body
 * @param {string} [token]
 * @returns {Promise<unknown>}
 */
export function httpPutJson(url, body, token) {
  return jsonFetch(url, "PUT", { body, token });
}

/**
 * @param {string} url
 * @param {string} [token]
 * @returns {Promise<unknown>}
 */
export function httpDeleteJson(url, token) {
  return jsonFetch(url, "DELETE", { token });
}
