import _ from "lodash";
import { Action, action } from "easy-peasy";
import { KeyPathFilter } from "./UndoRedoMiddleware";
import { AnyObject, copyFiltered, findGetters } from "./Utils";
import { HistoryStore, historyStore } from "./HistoryStore";

/**
 * WithUndo defines actions and history state to support Undo/Redo.
 *
 * The root application model interface should extend WithUndo.
 */
export interface WithUndo extends HasComputeds {
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
  const { model: modelWithUndo } = undoableModelAndHistory(model);
  return modelWithUndo;
}

export interface ModelAndHistory<M> {
  model: ModelWithUndo<M>;
  history: HistoryStore;
}

export function undoableModelAndHistory<M extends {}>(
  model: M
): ModelAndHistory<M> {
  const history = historyStore();
  const undoSave = action<WithUndo, UndoParams>((draftState, params) => {
    const state = filterState(draftState as WithUndo, params);
    history.save(state);
  });

  const undoReset = action<WithUndo, UndoParams>((draftState, params) => {
    const state = filterState(draftState as WithUndo, params);
    history.reset(state);
  });

  const undoUndo = action<WithUndo, UndoParams>((draftState, params) => {
    const undoState = history.undo();
    if (undoState) {
      Object.assign(draftState, undoState);
    }
  });

  const undoRedo = action<WithUndo, UndoParams>((draftState) => {
    const redoState = history.redo();
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

const undoModel: HasComputeds = {};

/** Used internally, to pass params and raw state from middleware config to action reducers.
 * Users of the actions do _not_ pass these parameters, they are attached by the middleware.
 */
interface UndoParams {
  noSaveKeys: KeyPathFilter;
  state: WithUndo;
}

function filterState(draftState: WithUndo, params: UndoParams): AnyObject {
  if (draftState._computeds === undefined) {
    // consider this initialization only happens once, is there an init hook we could use instead?
    // LATER consider, what if the model is hot-reloaded?
    draftState._computeds = findGetters(params.state);
  }
  const computeds = draftState._computeds;

  // remove keys that shouldn't be saved in undo history (computeds, user filtered, and history state)
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
      return isComputed || params.noSaveKeys(key, path);
    }
  );

  return filteredState;
}
