import { AnyAction, Dispatch, Middleware, MiddlewareAPI } from "redux";
import { replaceUndefined } from "./Utils";

/*
TODO 
 * add option for max number undo elements
*/

export interface UndoRedoConfig {
  /** function called to identify actions that should not be saved in undo history */
  noSaveActions?: ActionFilter;

  /** function called to identify keys that should not be saved in undo history */
  noSaveKeys?: KeyPathFilter;
}

export const undoDefaults = {
  noSaveActions: (_str: string) => false,
  noSaveKeys: (_str: string, _path: string[]) => false,
};

export type ActionFilter = (actionType: string) => boolean;
export type KeyPathFilter = (key: string, path: string[]) => boolean;

/** @returns redux middleware to support undo/redo actions. 
 * 
 * The middleware does two things:
 * 
 * 1) for undo/redo actions, the middlware attaches some information to the action.
 * It attaches the 'raw' state object. easy peasy normally sends only an immer
 * proxy of the raw state, and the proxy obscures the difference between computed
 * and regular properties.
 * At it attaches any user provided noSaveKeys filter.
 * 
 * 2) for normal actions, the middeware dispatches an additional undoSave action to
 * follow the original action. The reducer for the undoSave action will save the state
 * in undo history.
*/
export function undoRedo(config: UndoRedoConfig = {}): Middleware {
  const { noSaveActions, noSaveKeys } = replaceUndefined(config, undoDefaults);
  const result = (api: MiddlewareAPI) => (next: Dispatch<AnyAction>) => (
    action: AnyAction
  ) => {
    if (noSaveActions(action.type) || alwaysSkipAction(action.type)) {
      return next(action);
    } else if (undoAction(action.type)) {
      const state = api.getState();
      const enhancedAction = { ...action, payload: {noSaveKeys, state} };
      return next(enhancedAction);
    } else {
      const result = next(action);
      api.dispatch({ type: "@action.undoSave" });
      return result;
    }
  };

  return result;
}

function alwaysSkipAction(actionType: string): boolean {
  return actionType === "@action.ePRS" || actionType === "@@INIT";
}

function undoAction(actionType: string): boolean {
  return (
    actionType === "@action.undoSave" ||
    actionType === "@action.undoReset" ||
    actionType === "@action.undoUndo" ||
    actionType === "@action.undoRedo"
  );
}
