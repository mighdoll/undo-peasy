import { AnyAction, Dispatch, Middleware, MiddlewareAPI } from "redux";
import { replaceUndefined } from "./Utils";

/** @returns redux middleware to support undo/redo actions.
 *
 * The middleware does two things:
 *
 * 1) for undo/redo actions, the middlware attaches some information to the action.
 * It attaches the 'raw' state object. easy peasy normally sends only an immer
 * proxy of the raw state, and the proxy obscures the difference between computed
 * and regular properties.
 * For undo/redo actions the middleware also attaches the user provided noSaveKeys
 * filter function. (Note that passing the filter function with every undo/redo action
 * is a bit inefficient. The thought is to be cleaner for the undo-peasy user
 * with the config in one place, rather than some config on the middleware and
 * some config in undoable())
 *
 * 2) for normal actions, the middeware dispatches an additional undoSave action to
 * follow the original action. The reducer for the undoSave action will save the state
 * in undo history.
 */
export function undoRedo(): Middleware {
  const result = (api: MiddlewareAPI) => (next: Dispatch<AnyAction>) => (
    action: AnyAction
  ) => {
    if (alwaysSkipAction(action.type) || undoAction(action.type)) {
      return next(action);
    } else {
      const result = next(action);
      api.dispatch({ type: "@action.undoSave", payload: action });
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
