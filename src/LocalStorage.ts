import { LocalStorage } from "node-localstorage";
import { AnyObject } from "./Utils";
const keyPrefix = "undo-redo-";
const currentKey = keyPrefix + "state-current";

/** we store a stack of undo/redo state objects
 * currentKey holds the index of the current state
 * indices smaller than currentKey are undo history, larger indices are redo states.
 *
 * The current state is undo-redo-{currentKey}
 * The oldest undo state is undo-redo-0
 */

// for tests on nodejs
if (typeof localStorage === "undefined") {
  global.localStorage = new LocalStorage("./tmp");
}

export function save(state: {}): void {
  const currentDex = currentIndex();
  if (!currentDex) {
    saveState(state, 0);
  } else {
    deleteStates(currentDex + 1);
    saveState(state, currentDex + 1);
  }
}

export function clear(state: {}): void {
  deleteStates(0);
  saveState(state, 0);
}

export function undo(): AnyObject | undefined {
  const currentDex = currentIndex();
  if (!currentDex) {
    return undefined;
  }
  const indexString = (currentIndex -1).toString()  // TODO fixme
  localStorage.setItem(currentKey, indexString);
}

export function redo(): AnyObject | undefined {
  return undefined;
}

function saveState(state: AnyObject, index: number): void {
  const indexString = index.toString();
  localStorage.setItem(keyPrefix + indexString, JSON.stringify(state));
  localStorage.setItem(currentKey, indexString);
}

function saveFirstState(state: AnyObject): void {
  localStorage.setItem(keyPrefix + "0", JSON.stringify(state));
  resetCurrent();
}

function resetCurrent() {
  localStorage.setItem(currentKey, "0");
}

function currentIndex(): number | undefined {
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
