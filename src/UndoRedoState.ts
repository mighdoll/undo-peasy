import _ from "lodash";
import { Action, action } from "easy-peasy";
import { KeyPathFilter } from "./UndoRedoMiddleware";
import { AnyObject, copyFiltered, findGetters } from "./Utils";
import { saveAsCurrent } from "./LocalStorage";

/**
 * WithUndo defines actions and history state to support Undo/Redo.
 *
 * The root application model interface should extend WithUndo.
 */
export interface WithUndo extends WithUndoHistory {
  undoSave: Action<WithUndo, UndoParams | void>;
  undoReset: Action<WithUndo, UndoParams | void>;
  undoUndo: Action<WithUndo, UndoParams | void>;
  undoRedo: Action<WithUndo, UndoParams | void>;
}

/**
 * undoable adds state and action fields to a model instance support undo.
 *
 * The root application model should be wrapped in undoable().
 * @param model application model
 */
export function undoable<M extends {}>(model: M): ModelWithUndo<M> {
  return {
    ...model,
    undoHistory: undoModel,
    undoSave,
    undoUndo,
    undoRedo,
    undoReset,
  };
}

export type ModelWithUndo<T> = {
  [P in keyof T]: T[P];
} &
  WithUndo;

export interface UndoHistory {
  undo: {}[];
  redo: {}[];
  current?: {};
  computeds?: string[][]; // paths of all computed properties in the model (not persisted in the history)
}

const undoModel: UndoHistory = { undo: [], redo: [] };

/** Used internally, to pass params and raw state from middleware config to action reducers.
 * Users of the actions do _not_ need to pass these parameters, they are attached by the middleware.
 */
interface UndoParams {
  noSaveKeys: KeyPathFilter;
  state: WithUndo;
}

interface WithUndoHistory {
  undoHistory: UndoHistory;
}

const undoSave = action<WithUndo, UndoParams>((draftState, params) => {
  const history = draftState.undoHistory;
  history.redo.length = 0;
  if (history.current) {
    history.undo.push(history.current);
  }
  saveCurrent(draftState as WithUndo, params);
});

const undoReset = action<WithUndo, UndoParams>((draftState, params) => {
  const history = draftState.undoHistory;
  history.redo.length = 0;
  history.undo.length = 0;
  saveCurrent(draftState as WithUndo, params);
});

const undoUndo = action<WithUndo, UndoParams>((draftState, params) => {
  const history = draftState.undoHistory;
  const undoState = history.undo.pop();
  if (undoState) {
    if (history.current) {
      history.redo.push(history.current);
    }
    history.current = undoState;

    Object.assign(draftState, undoState);
  }
});

const undoRedo = action<WithUndo, UndoParams>((draftState) => {
  const history = draftState.undoHistory;
  const redoState = history.redo.pop();
  if (redoState) {
    if (history.current) {
      history.undo.push(history.current);
    }
    history.current = redoState;

    Object.assign(draftState, redoState);
  }
});

function saveCurrent(draftState: WithUndo, params: UndoParams) {
  const history = draftState.undoHistory;
  if (!history.computeds) {
    // consider this initialization only happens once, is there an init hook we could use instead?
    // LATER consider, what if the model is hot-reloaded?
    history.computeds = findGetters(params.state);
  }
  const computeds = history.computeds!;

  // remove keys that shouldn't be saved in undo history (computeds, user filtered, and history state)
  const filteredState: AnyObject = copyFiltered(
    draftState,
    (_value, key, path) => {
      if (path.length === 0 && key === "undoHistory") {
        return true;
      }
      const fullPath = path.concat([key]);
      const isComputed = !!computeds.find((computedPath) =>
        _.isEqual(fullPath, computedPath)
      );
      return isComputed || params.noSaveKeys(key, path);
    }
  );

  draftState.undoHistory.current = filteredState;
}
