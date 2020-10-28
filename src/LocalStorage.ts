import { LocalStorage } from "node-localstorage";
import { AnyObject } from "./Utils";

export const keyPrefix = "undo-redo-";
export const currentKey = keyPrefix + "state-current";

/** we store a stack of undo/redo state objects
 * currentKey holds the index of the current state
 * indices smaller than currentKey are undo history, larger indices are redo states.
 *
 * The current state is undo-redo-{currentKey}
 * The oldest undo state is undo-redo-0
 */

// for tests on nodejs only, we define a localStorage
if (typeof localStorage === "undefined") {
  global.localStorage = new LocalStorage("./tmp");
}

export function save(state: AnyObject): void {
  const currentDex = currentIndex();
  if (currentDex === undefined) {
    saveState(state, 0);
  } else {
    deleteStates(currentDex + 1);
    saveState(state, currentDex + 1);
  }
}

export function reset(state: AnyObject): void {
  deleteStates(0);
  saveState(state, 0);
}

export function undo(): AnyObject | undefined {
  const currentDex = currentIndex();
  if (currentDex === undefined || currentDex === 0) {
    return undefined;
  }
  const indexString = (currentDex - 1).toString();
  const state = localStorage.getItem(keyPrefix + indexString);
  if (state === null) {
    console.log("unspected null", indexString);
    return undefined;
  }
  localStorage.setItem(currentKey, indexString);
  return JSON.parse(state);
}

export function redo(): AnyObject | undefined {
  return undefined;
}

function saveState(state: AnyObject, index: number): void {
  console.log("save,  index:", index);
  const indexString = index.toString();
  localStorage.setItem(keyPrefix + indexString, JSON.stringify(state));
  localStorage.setItem(currentKey, indexString);
}

/** exported for testing */
export function currentIndex(): number | undefined {
  const valueString = localStorage.getItem(currentKey);
  if (valueString) {
    return parseInt(valueString);
  } else {
    return undefined;
  }
}

function deleteStates(start: number): void {
  const key = keyPrefix + start;
  const item = localStorage.getItem(key);
  if (item) {
    localStorage.removeItem(key);
    deleteStates(start + 1);
  }
}
