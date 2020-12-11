import { Action, action } from "easy-peasy";
import _ from "lodash";
import { HistoryStore, historyStore } from "./HistoryStore";
import { AnyObject, copyFiltered, findModelComputeds } from "./Utils";

/** Implementation strategy overview for undo/redo
 *
 * Add easy-peasy actions for undo and redo. (Also add actions for reset and save, though these
 * aren't typically needed by users.)
 *
 * Store a stack of undo/current/redo states. These are stored as json
 * strings in the browser's localStorage key value store.
 *
 * Middleware to automatically trigger the save action after other
 * easy-peasy or redux actions.
 *
 * Note that computed properties and view properties specified by the programmer are not
 * saved. Computed and view properties are merged into the current app state
 * on undo/redo.
 */

/**
 * WithUndo specifies some actions and state to support Undo/Redo on your easy-peasy
 * model type.
 *
 * The root application model interface should extend WithUndo.
 */
export interface WithUndo {
  undoSave: Action<WithUndo>;
  undoReset: Action<WithUndo>;
  undoUndo: Action<WithUndo>;
  undoRedo: Action<WithUndo>;
}

export type KeyPathFilter = (key: string, path: string[]) => boolean;

export interface HistoryOptions {
  /** save no more than this many undo states */
  maxHistory?: number;

  /** don't save state keys matching this filter (e.g. transient view in the state) */
  noSaveKeys?: KeyPathFilter;

  /** set to true to log each saved state */
  logDiffs?: boolean;
}

/**
 * extend a model instance with undo actions and metadata
 *
 * The root application model should be wrapped in undoable().
 * @param model application model
 */
export function undoable<M extends {}>(
  model: M,
  historyOptions?: HistoryOptions
): ModelWithUndo<M> {
  const { model: modelWithUndo } = undoableModelAndHistory(
    model,
    historyOptions
  );
  return modelWithUndo;
}

export interface ModelAndHistory<M> {
  model: ModelWithUndo<M>;
  history: HistoryStore;
}

const skipNoKeys = (_str: string, _path: string[]) => false;
/** (api for testing)
 *
 * extend a model instance with undo actions and metadata, and also return
 * the history store.
 */
export function undoableModelAndHistory<M extends {}>(
  model: M,
  historyOptions?: HistoryOptions
): ModelAndHistory<M> {
  const computeds = findModelComputeds(model);
  const history = historyStore(historyOptions);
  const noSaveKeys = historyOptions?.noSaveKeys || skipNoKeys;
  const undoSave = action<WithUndo>((draftState) => {
    const state = filterState(draftState as WithUndo, noSaveKeys, computeds);
    history.save(state);
  });

  const undoReset = action<WithUndo>((draftState) => {
    const state = filterState(draftState as WithUndo, noSaveKeys, computeds);
    history.reset(state);
  });

  const undoUndo = action<WithUndo>((draftState) => {
    const undoState = history.undo(draftState);
    if (undoState) {
      Object.assign(draftState, undoState);
    }
  });

  const undoRedo = action<WithUndo>((draftState) => {
    const redoState = history.redo(draftState);
    if (redoState) {
      Object.assign(draftState, redoState);
    }
  });

  const modelWithUndo = {
    ...model,
    undoSave,
    undoUndo,
    undoRedo,
    undoReset,
  };
  return { model: modelWithUndo, history };
}

export type ModelWithUndo<T> = {
  [P in keyof T]: T[P];
} &
  WithUndo;

/**
 * Return a copy of state, removing properties that don't need to be persisted.
 *
 * In particular, remove computed properties and properties that match a user filter for e.g. interim view state.
 */
function filterState(
  draftState: WithUndo,
  noSaveKeys: KeyPathFilter,
  computeds: string[][]
): AnyObject {
  // remove keys that shouldn't be saved in undo history (computeds, user filtered, and computeds metadata)
  const filteredState: AnyObject = copyFiltered(
    draftState,
    (_value, key, path) => {
      const fullPath = path.concat([key]);
      const isComputed = !!computeds.find((computedPath) =>
        _.isEqual(fullPath, computedPath)
      );
      return isComputed || noSaveKeys(key, path);
    }
  );

  return filteredState;
}
