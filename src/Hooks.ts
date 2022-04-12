import { createTypedHooks } from "easy-peasy";
import { WithUndo } from "./Actions";

const typedHooks = createTypedHooks<WithUndo>();

const useStoreActions = typedHooks.useStoreActions;

export function useUndoGroup<T>(): (fn: () => T, msg?: string) => T {
  const undoGroupStart = useStoreActions((model) => model.undoGroupStart);
  const undoGroupComplete = useStoreActions((model) => model.undoGroupComplete);

  return function undoGroup<T>(fn: () => T, msg?: string): T {
    let result: T;

    undoGroupStart(msg);
    try {
      result = fn();
    } finally {
      undoGroupComplete();
    }
    return result;
  };
}

export function useUndoIgnore<T>(): (fn: () => T, msg?: string) => T {
  const undoGroupStart = useStoreActions((model) => model.undoGroupStart);
  const undoGroupIgnore = useStoreActions((model) => model.undoGroupIgnore);

  return function undoGroup<T>(fn: () => T, msg?: string): T {
    let result: T;

    undoGroupStart(msg);
    try {
      result = fn();
    } finally {
      undoGroupIgnore();
    }
    return result;
  };
}
