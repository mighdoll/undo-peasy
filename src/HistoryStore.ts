import { compare } from "fast-json-patch";
import _ from "lodash";
import { HistoryOptions } from "./Actions";
import { AnyObject } from "./Utils";

export const keyPrefix = "undo-redo-";
export const currentKey = keyPrefix + "state-current";
export const oldestKey = keyPrefix + "state-oldest";

/** Store a stack of undo/redo state objects in localStorage.
 *
 * Each undo redo state is stored in a separate key/value.
 * The oldest undo state is stored with the key: "undo-redo-0",
 * more recent states are "-1", "-2", etc.
 *
 * The current state is stored in the key "undo-redo-state-current"
 * The oldest state is stored in the key "undo-redo-state-oldest"
 *
 * If the number of saved states would exceed maxHistory, the oldest
 * state is dropped. (e.g. after dropping one state, the oldest state
 * becomes "undo-redo-1".)
 *
 * keys with indices smaller than the current state hold undo states,
 * keys with larger indices hold redo states.
 */

export interface HistoryStore {
  save: (state: AnyObject, prevState: AnyObject | undefined) => void;
  reset: (state: AnyObject) => void;
  undo: (state: AnyObject) => AnyObject | undefined;
  redo: (state: AnyObject) => AnyObject | undefined;

  // functions with an _ prefix are exposed for testing, but not intended for public use
  _currentIndex: () => number | undefined;
  _oldestIndex: () => number | undefined;
  _allSaved: () => AnyObject[];
  _erase: () => void;
  _getState: (index: number) => AnyObject | undefined;
}

const defaultMaxHistory = 250;

/** return a persistent store that holds undo/redo history
 * @param toPlainState remove computed and view fields from a state object
 */
export function historyStore<M extends AnyObject>(
  toPlainState: (state: AnyObject) => AnyObject,
  historyOptions?: HistoryOptions<M>
): HistoryStore {
  const maxHistory = historyOptions?.maxHistory || defaultMaxHistory;
  const storage = getStorage();
  const logDiffs = historyOptions?.logDiffs || false;

  return {
    save,
    reset,
    undo,
    redo,
    _currentIndex: currentIndex,
    _oldestIndex: oldestIndex,
    _allSaved,
    _erase,
    _getState,
  };

  function save(state: AnyObject, prevState: AnyObject | undefined): void {
    const currentDex = currentIndex();
    const oldestDex = oldestIndex() || 0;
    if (currentDex === undefined) {
      if (prevState) {
        saveState(prevState, 0);
        saveState(state, 1);
      } else {
        saveState(state, 0);
      }
      storage.setItem(oldestKey, "0");
      if (logDiffs) {
        console.log("save\n", state);
      }
    } else {
      const newDex = saveStateIfNew(state, currentDex);

      if (newDex !== currentDex) {
        // delete now invalid redo states
        deleteNewest(newDex + 1);

        // limit growth of old states
        const size = newDex - oldestDex + 1;
        if (size > maxHistory) {
          deleteOldest(maxHistory);
        }
      }
    }
  }

  function reset(state: AnyObject): void {
    deleteNewest(0);
    saveState(state, 0);
    storage.setItem(oldestKey, "0");
    if (logDiffs) {
      console.log("reset\n", state);
    }
  }

  function undo(state: AnyObject): AnyObject | undefined {
    const currentDex = currentIndex();
    if (currentDex === undefined || currentDex === 0) {
      return undefined;
    }
    const undoDex = (currentDex - 1).toString();
    const stateString = storage.getItem(keyPrefix + undoDex);
    if (stateString === null) {
      console.log("unexpected null entry at index:", undoDex);
      return undefined;
    }
    storage.setItem(currentKey, undoDex);
    const undoState = JSON.parse(stateString);
    if (logDiffs) {
      const rawState = toPlainState(state);
      const diff = compare(rawState, undoState);
      console.log("undo\n", ...diff);
    }
    return undoState;
  }

  function redo(state: AnyObject): AnyObject | undefined {
    const currentDex = currentIndex();
    if (currentDex === undefined) {
      return undefined;
    }
    const redoDex = (currentDex + 1).toString();
    const stateString = storage.getItem(keyPrefix + redoDex);
    if (stateString === null) {
      return undefined;
    }
    storage.setItem(currentKey, redoDex);
    const redoState = JSON.parse(stateString);
    if (logDiffs) {
      const rawState = toPlainState(state);
      const diff = compare(rawState, redoState);
      console.log("redo\n", ...diff);
    }
    return redoState;
  }

  function saveState(state: AnyObject, index: number): void {
    saveStateString(JSON.stringify(state), index);
  }

  function saveStateIfNew(state: AnyObject, currentDex: number): number {
    const currentStateString = storage.getItem(keyPrefix + currentDex);
    const stateString = JSON.stringify(state);
    if (currentStateString !== stateString) {
      logDiff(state, currentStateString);
      const newDex = currentDex + 1;
      saveStateString(stateString, newDex);

      return newDex;
    } else {
      return currentDex;
    }
  }

  function logDiff(newState: AnyObject, oldStateString: string | null) {
    if (logDiffs) {
      if (oldStateString) {
        const oldState = JSON.parse(oldStateString);
        const diff = compare(oldState, newState);
        console.log("save:\n", ...diff);
      } else {
        console.log("save:\n", newState);
      }
    }
  }

  function saveStateString(stateString: string, index: number): void {
    const indexString = index.toString();
    storage.setItem(keyPrefix + indexString, stateString);
    storage.setItem(currentKey, indexString);
  }

  function currentIndex(): number | undefined {
    const valueString = storage.getItem(currentKey);
    if (valueString) {
      return parseInt(valueString);
    } else {
      return undefined;
    }
  }

  function oldestIndex(): number | undefined {
    const valueString = storage.getItem(oldestKey);
    if (valueString) {
      return parseInt(valueString);
    } else {
      return undefined;
    }
  }

  /** delete all states newer than start */
  function deleteNewest(start: number): void {
    const key = keyPrefix + start;
    const item = storage.getItem(key);
    if (item) {
      storage.removeItem(key);
      deleteNewest(start + 1);
    }
  }

  /** delete oldest states until we fit under maxSize */
  function deleteOldest(maxHistory: number): void {
    const currentDex = currentIndex() || 0;
    const oldestDex = oldestIndex() || 0;
    const size = currentDex - oldestDex + 1;
    if (currentDex - maxHistory < 0 || size < maxHistory) {
      console.log("returning early...");
      return;
    }
    const newOldest = Math.max(0, currentDex - maxHistory + 1);
    for (let i = oldestDex; i < newOldest; i++) {
      storage.removeItem(keyPrefix + i);
    }
    storage.setItem(oldestKey, newOldest.toString());
  }

  /** for testing */
  function _allSaved(): AnyObject[] {
    const results: AnyObject[] = [];
    _.times(10).forEach((i) => {
      const item = storage.getItem(keyPrefix + i);
      if (item) {
        results.push(JSON.parse(item));
      }
    });
    return results;
  }

  function _erase(): void {
    storage.clear();
  }

  function _getState(index: number): AnyObject | undefined {
    const item = storage.getItem(keyPrefix + index);
    if (!item) {
      return undefined;
    }
    return JSON.parse(item);
  }
}

function getStorage(): Storage {
  return localStorage; // for now, just one store. (tests use one mocked store per test thread.)
}
