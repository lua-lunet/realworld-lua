/**
 * In-memory auth store. The signed-in user (with token) is held in module
 * state only — never in localStorage — and is structuralFreeze'd, so no view
 * can mutate it. Subscribers are notified for re-render.
 */
import { structuralFreeze } from "../src/structural-freeze.mjs";

/** @typedef {import("./validators.mjs").UserRow} UserRow */

/** @type {{current: Readonly<UserRow> | null}} */
const state = { current: null };
/** @type {Set<() => void>} */
const subscribers = new Set();

/**
 * @param {() => void} callback
 * @returns {() => void}
 */
export function onAuthChange(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

/** @returns {Readonly<UserRow> | null} */
export function currentUser() {
  return state.current;
}

/**
 * @param {UserRow} user validated, kernel-accepted login response user
 */
export function signIn(user) {
  state.current = structuralFreeze(user);
  for (const callback of subscribers) callback();
}

export function signOut() {
  state.current = null;
  for (const callback of subscribers) callback();
}
