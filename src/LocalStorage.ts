import { LocalStorage } from "node-localstorage";
const keyPrefix = "undo-redo";
const currentSuffix = "-state-current";
const currentStateKey = keyPrefix + currentSuffix;

// for tests on nodejs
if (typeof localStorage === "undefined") {
  global.localStorage = new LocalStorage("./tmp");
}

export function saveCurrentState(state: {}): void {
  localStorage.setItem(currentStateKey, JSON.stringify(state));
}
