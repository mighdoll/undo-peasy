import { AnyAction, Dispatch, Middleware, MiddlewareAPI } from "redux";

/** @returns redux middleware to support undo/redo actions.
 *
 * The middleware does two things:
 *
 * 1) for undo/redo actions, the middlware does nothing. The undo/redo reducer will handle those.
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
      const prevState = api.getState();
      const result = next(action);
      api.dispatch({
        type: "@action.undoSave",
        payload: { action, prevState },
      });
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
    actionType === "@action.undoRedo" ||
    actionType === "@action.undoGroupStart" ||
    actionType === "@action.undoGroupComplete"
  );
}
