const keyPrefix = "undo-redo";
const currentSuffix = "-state-current";
const currentStateKey = keyPrefix + currentSuffix;

export function saveCurrentState(state: {}): void {
  localStorage.setItem(currentStateKey, JSON.stringify(state));
}

