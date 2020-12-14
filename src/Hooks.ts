import { createTypedHooks } from "easy-peasy";
import { WithUndo } from "./Actions";

const typedHooks = createTypedHooks<WithUndo>();

const useStoreActions = typedHooks.useStoreActions;

export function useUndoGroup<T>(): (fn: () => T) => T {
  const undoGroupStart = useStoreActions((model) => model.undoGroupStart);
  const undoGroupComplete = useStoreActions((model) => model.undoGroupComplete);

  return function undoGroup<T>(fn: () => T): T {
    let result: T;

    undoGroupStart();
    try {
      result = fn();
    } finally {
      undoGroupComplete();
    }
    return result;
  };
}
