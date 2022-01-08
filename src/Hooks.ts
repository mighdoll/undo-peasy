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

export function useUndoIgnore<T>(): (fn: () => T) => T {
  const groupStart = useStoreActions((model) => model.undoGroupStart);
  const groupIgnore = useStoreActions((model) => model.undoGroupIgnore);

  return function undoGroup<T>(fn: () => T): T {
    let result: T;

    groupStart();
    try {
      result = fn();
    } finally {
      groupIgnore();
    }
    return result;
  };
}
