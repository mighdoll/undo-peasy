import _ from "lodash";
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

export interface HistoryStore {
  save: (state: AnyObject) => void;
  reset: (state: AnyObject) => void;
  undo: () => AnyObject | undefined;
  redo: () => AnyObject | undefined;
  _currentIndex: () => number | undefined;
  _allSaved: () => AnyObject[];
  _erase: () => void;
  _getState: (index: number) => AnyObject | undefined;
}

/** return a persistent store that holds undo/redo history */
export function historyStore(): HistoryStore {
  const storage = getStorage();

  return {
    save,
    reset,
    undo,
    redo,
    _currentIndex: currentIndex,
    _allSaved: allSaved,
    _erase: erase,
    _getState: getState,
  };

  function save(state: AnyObject): void {
    const currentDex = currentIndex();
    if (currentDex === undefined) {
      saveState(state, 0);
    } else {
      deleteStates(currentDex + 1);
      saveState(state, currentDex + 1);
    }
  }

  function reset(state: AnyObject): void {
    deleteStates(0);
    saveState(state, 0);
  }

  function undo(): AnyObject | undefined {
    const currentDex = currentIndex();
    if (currentDex === undefined || currentDex === 0) {
      return undefined;
    }
    const undoDex = (currentDex - 1).toString();
    const state = storage.getItem(keyPrefix + undoDex);
    if (state === null) {
      console.log("unexpected null entry at index:", undoDex);
      return undefined;
    }
    storage.setItem(currentKey, undoDex);
    return JSON.parse(state);
  }

  function redo(): AnyObject | undefined {
    const currentDex = currentIndex();
    if (currentDex === undefined) {
      return undefined;
    }
    const redoDex = (currentDex + 1).toString();
    const state = storage.getItem(keyPrefix + redoDex);
    if (state === null) {
      return undefined;
    }
    storage.setItem(currentKey, redoDex);
    return JSON.parse(state);
  }

  function saveState(state: AnyObject, index: number): void {
    const indexString = index.toString();
    storage.setItem(keyPrefix + indexString, JSON.stringify(state));
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

  function deleteStates(start: number): void {
    const key = keyPrefix + start;
    const item = storage.getItem(key);
    if (item) {
      storage.removeItem(key);
      deleteStates(start + 1);
    }
  }

  /** for testing */
  function allSaved(): AnyObject[] {
    const results: AnyObject[] = [];
    _.times(10).forEach((i) => {
      const item = storage.getItem(keyPrefix + i);
      if (item) {
        results.push(JSON.parse(item));
      }
    });
    return results;
  }

  function erase(): void {
    storage.clear();
  }

  function getState(index:number):AnyObject|undefined {
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
