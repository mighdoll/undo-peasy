import { Action, action, State } from "easy-peasy";
import _ from "lodash";
import { HistoryStore, historyStore } from "./HistoryStore";
import { AnyObject, copyFiltered, findModelComputeds } from "./Utils";
import { AnyAction } from "redux";

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
  undoSave: Action<WithUndo, AnyAction>;
  undoReset: Action<WithUndo>;
  undoUndo: Action<WithUndo>;
  undoRedo: Action<WithUndo>;
}

export type KeyPathFilter = (key: string, path: string[]) => boolean;

export interface HistoryOptions<M extends AnyObject> {
  /** save no more than this many undo states */
  maxHistory?: number;

  /** don't save state keys matching this filter (e.g. transient view in the state) */
  noSaveKeys?: KeyPathFilter;

  /** set to true to log each saved state */
  logDiffs?: boolean;

  /**  */
  skipAction?: ActionStateFilter<State<M>>;
}

export type ActionStateFilter<M extends AnyObject> = (
  state: State<M>,
  action: AnyAction
) => boolean;

/**
 * Extend a model instance with undo actions and metadata
 *
 * The root application model should be wrapped in undoable().
 * @param model application model
 */
export function undoable<M extends AnyObject>(
  model: M,
  historyOptions?: HistoryOptions<M>
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

/** (internal api for undoable(), exposes more for testing)
 *
 * extend a model instance with undo actions and metadata, and also return
 * the history store.
 */
export function undoableModelAndHistory<M extends {}>(
  model: M,
  historyOptions?: HistoryOptions<M>
): ModelAndHistory<M> {
  const computeds = findModelComputeds(model);
  const history = historyStore(filterState, historyOptions);
  const noSaveKeys = historyOptions?.noSaveKeys || skipNoKeys;
  const skipAction = historyOptions?.skipAction || (() => false);

  const undoSave = action<WithUndo, AnyAction>((draftState, prevAction) => {
    const state = filterState(draftState);
    if (!skipAction(state as any, prevAction)) {
      history.save(state);
    }
  });

  const undoReset = action<WithUndo>((draftState) => {
    const state = filterState(draftState);
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

  /**
   * Return a copy of state, removing properties that don't need to be persisted.
   *
   * In particular, remove computed properties and properties that match a user filter for e.g. interim view state.
   */
  function filterState(draftState: AnyObject): AnyObject {
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
}

export type ModelWithUndo<T> = {
  [P in keyof T]: T[P];
} &
  WithUndo;
