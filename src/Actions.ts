import { Action, action } from "easy-peasy";
import _ from "lodash";
import { HistoryStore, historyStore } from "./HistoryStore";
import { AnyObject, copyFiltered, findGetters } from "./Utils";

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
export interface WithUndo extends HasComputeds {
  undoSave: Action<WithUndo, UndoParams | void>;
  undoReset: Action<WithUndo, UndoParams | void>;
  undoUndo: Action<WithUndo, UndoParams | void>;
  undoRedo: Action<WithUndo, UndoParams | void>;
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
  const history = historyStore(historyOptions);
  const noSaveKeys = historyOptions?.noSaveKeys || skipNoKeys;
  const undoSave = action<WithUndo, UndoParams>((draftState, params) => {
    const state = filterState(draftState as WithUndo, params, noSaveKeys);
    history.save(state);
  });

  const undoReset = action<WithUndo, UndoParams>((draftState, params) => {
    const state = filterState(draftState as WithUndo, params, noSaveKeys);
    history.reset(state);
  });

  const undoUndo = action<WithUndo, UndoParams>((draftState, params) => {
    const undoState = history.undo(draftState);
    if (undoState) {
      Object.assign(draftState, undoState);
    }
  });

  const undoRedo = action<WithUndo, UndoParams>((draftState) => {
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

export interface HasComputeds {
  _computeds?: string[][]; // paths of all computed properties in the model (not persisted in the history)
}

/** Used internally, to pass params and raw state from middleware config to action reducers.
 * Users of the actions do _not_ pass these parameters, they are attached by the middleware.
 */
interface UndoParams {
  state: WithUndo;
}

/**
 * Return a copy of state, removing properties that don't need to be persisted.
 *
 * In particular, remove computed properties and properties that match a user filter for e.g. interim view state.
 */
function filterState(
  draftState: WithUndo,
  params: UndoParams,
  noSaveKeys: KeyPathFilter
): AnyObject {
  if (draftState._computeds === undefined) {
    // consider this initialization only happens once, is there an init hook we could use instead?
    // LATER, consider what if the model is hot-reloaded?
    draftState._computeds = findGetters(params.state);
  }
  const computeds = draftState._computeds;

  // remove keys that shouldn't be saved in undo history (computeds, user filtered, and computeds metadata)
  const filteredState: AnyObject = copyFiltered(
    draftState,
    (_value, key, path) => {
      if (path.length === 0 && key === "_computeds") {
        return true;
      }
      const fullPath = path.concat([key]);
      const isComputed = !!computeds.find((computedPath) =>
        _.isEqual(fullPath, computedPath)
      );
      return isComputed || noSaveKeys(key, path);
    }
  );

  return filteredState;
}
