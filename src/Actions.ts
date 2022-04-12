import { Action, action, State } from "easy-peasy";
import _ from "lodash";
import { AnyAction } from "redux";
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
  undoSave: Action<WithUndo, ActionAndState | void>;
  undoReset: Action<WithUndo>;
  undoUndo: Action<WithUndo>;
  undoRedo: Action<WithUndo>;
  undoGroupStart: Action<WithUndo>;
  undoGroupComplete: Action<WithUndo>;
  undoGroupIgnore: Action<WithUndo>;
}

interface ActionAndState {
  action: AnyAction;
  prevState?: AnyObject;
}

export type KeyPathFilter = (key: string, path: string[]) => boolean;

export interface UndoOptions<M extends AnyObject> {
  /** save no more than this many undo states */
  maxHistory?: number;

  /** don't save state keys matching this filter (e.g. transient view in the state) */
  noSaveKeys?: KeyPathFilter;

  /** set to true to log each saved state */
  logDiffs?: boolean;

  /** set to true to log grouping levels */
  logGroups?: boolean;

  /** return true for actions that should not be saved into undo history */
  skipAction?: ActionStateFilter<M>;
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
  historyOptions?: UndoOptions<M>
): ModelWithUndo<M> {
  const { model: modelWithUndo } = undoableModelAndHistory(
    model,
    historyOptions
  );
  return modelWithUndo;
}

export interface EnrichedModel<M> {
  model: ModelWithUndo<M>;
  history: HistoryStore;
}

export interface ControlApi {
  undoGroup: <T>(fn: () => T) => T;
  undoPause: () => void;
  undoContinue: () => void;
}

const skipNoKeys = (_str: string, _path: string[]) => false;

/** (internal api for undoable(), exposes more for testing)
 *
 * extend a model instance with undo actions and metadata, and also return
 * the history store.
 */
export function undoableModelAndHistory<M extends AnyObject>(
  model: M,
  historyOptions?: UndoOptions<M>
): EnrichedModel<M> {
  const computeds = findModelComputeds(model);
  const history = historyStore(filterState, historyOptions);
  const noSaveKeys = historyOptions?.noSaveKeys || skipNoKeys;
  const skipAction = historyOptions?.skipAction || (() => false);
  let grouped = 0;

  const undoSave = action<WithUndo, ActionAndState>(
    (draftState, actionState) => {
      if (grouped === 0) {
        if (actionState) {
          const { action, prevState } = actionState;
          save(draftState, action, prevState);
        } else {
          save(draftState, { type: "@manualsave" });
        }
      }
    }
  );

  function save(
    draftState: AnyObject,
    action: AnyAction,
    prevState?: AnyObject
  ) {
    const state = filterState(draftState) as State<M>;
    if (!skipAction(state, action)) {
      if (prevState && !history.initialized()) {
        const prevFiltered = filterState(prevState);
        history.save(state, prevFiltered);
      } else {
        history.save(state, prevState);
      }
    }
  }

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

  const undoGroupStart = action<WithUndo>(() => {
    grouped++;
  });

  const undoGroupComplete = action<WithUndo>((draftState) => {
    grouped--;
    if (grouped <= 0) {
      grouped = 0;
      save(draftState, { type: "@action.undoGroupComplete" }, draftState);
    }
  });

  const undoGroupIgnore = action<WithUndo>((draftState) => {
    grouped--;
    if (grouped <= 0) {
      grouped = 0;
    }
  });

  const modelWithUndo = {
    ...model,
    undoSave,
    undoUndo,
    undoRedo,
    undoReset,
    undoGroupStart,
    undoGroupComplete,
    undoGroupIgnore,
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
