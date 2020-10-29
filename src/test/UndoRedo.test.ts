import "chai/register-should";
import {
  action,
  Action,
  ActionMapper,
  Computed,
  createStore,
  Store,
  ValidActionProperties,
} from "easy-peasy";
import { enableES5 } from "immer";
import { HistoryStore } from "../LocalStorage";
import { undoRedo as undoRedoMiddleware } from "../UndoRedoMiddleware";
import { ModelWithUndo, undoableModelAndHistory } from "../UndoRedoState";
import { AnyObject } from "../Utils";

enableES5();

interface Model {
  count: number;
  increment: Action<Model>;
}

const simpleModel: Model = {
  count: 0,
  increment: action((state) => {
    state.count++;
  }),
};

interface ViewModel {
  count: number;
  view: number;
  increment: Action<ViewModel>;
  doubleView: Action<ViewModel>;
  countSquared: Computed<ViewModel, number>;
}

// const viewModel: ViewModel = undoable({
//   count: 0,
//   view: 7,
//   doubleView: action((state) => {
//     state.view *= 2;
//   }),
//   increment: action((state) => {
//     state.count++;
//   }),
//   countSquared: computed([(model) => model.view], (view) => view * view),
// });

interface StoreAndActions<M extends AnyObject> {
  store: Store<M>;
  actions: ActionMapper<
    ModelWithUndo<M>,
    ValidActionProperties<ModelWithUndo<M>>
  >;
  history: HistoryStore;
}

function withStore(fn: (storAndActions: StoreAndActions<Model>) => void) {
  const { model, history } = undoableModelAndHistory(simpleModel);
  history._erase();
  const store = createStore(model, {
    middleware: [undoRedoMiddleware()],
  });
  const actions = store.getActions();
  actions.undoSave();
  try {
    fn({ store, actions, history });
  } finally {
    history._erase();
  }
}

// function makeViewStore() {
//   localStorage.clear();
//   const store = createStore(undoable(viewModel), {
//     middleware: [undoRedoMiddleware({ noSaveKeys, noSaveActions })],
//   });
//   const actions = store.getActions();
//   actions.undoSave();
//   return { store, actions };
// }

function noSaveKeys(key: string): boolean {
  return key === "view";
}

function noSaveActions(actionType: string): boolean {
  return actionType.startsWith("@action.doubleView");
}

function historyExpect(
  history: HistoryStore,
  expectLength: number,
  expectIndex: number
): void {
  const index = history._currentIndex()!;
  const length = history._allSaved().length;
  index.should.equal(expectIndex);
  length.should.equal(expectLength);
}

test("save an action", () => {
  withStore(({ actions, history }) => {
    actions.increment();

    historyExpect(history, 2, 1);
  });
});

test("save two actions", () => {
  withStore(({ actions, history }) => {
    actions.increment();
    actions.increment();
    historyExpect(history, 3, 2);
  });
});

test("undo an action", () => {
  withStore(({ store, history, actions }) => {
    actions.increment();
    actions.undoUndo();
    store.getState().count.should.equal(0);
    historyExpect(history, 2, 0);
  });
});

test("undo two actions", () => {
  withStore(({ store, history, actions }) => {
    actions.increment();
    actions.increment();
    actions.undoUndo();
    actions.undoUndo();
    store.getState().count.should.equal(0);
    historyExpect(history, 3, 0);
  });
});

test("two actions, undo one", () => {
  withStore(({ store, history, actions }) => {
    actions.increment();
    actions.increment();
    actions.undoUndo();
    store.getState().count.should.equal(1);
    historyExpect(history, 3, 1);
  });
});

test.skip("redo", () => {
  withStore(({ store, history, actions }) => {
    actions.increment();
    actions.increment();
    actions.increment();
    store.getState().count.should.equal(3);
    actions.undoUndo();
    actions.undoUndo();
    store.getState().count.should.equal(1);
    actions.undoRedo();
    store.getState().count.should.equal(2);

    historyExpect(history, 4, 1);
  });
});

test("undo empty doesn't crash", () => {
  withStore(({ actions }) => {
    actions.undoUndo();
  });
});

test("redo empty doesn't crash", () => {
  withStore(({ actions }) => {
    actions.undoRedo();
  });
});

test("reset clears history", () => {
  withStore(({ store, history, actions }) => {
    actions.increment();
    actions.increment();
    actions.undoReset();
    store.getState().count.should.equal(2);
    historyExpect(history, 1, 0);
  });
});

// test.skip("views are not saved", () => {
//   const { store } = makeViewStore();
//   // const history = store.getState().undoHistory;
//   // assert((history.current as any).view === undefined);
// });

// test.skip("views are restored by undo/redo", () => {
//   const { store, actions } = makeViewStore();
//   actions.increment();
//   actions.doubleView();
//   actions.undoUndo();
//   store.getState().view.should.equal(viewModel.view * 2);
// });

// test.skip("views actions are not saved", () => {
//   const { store, actions } = makeViewStore();
//   actions.doubleView();
//   // store.getState().undoHistory.undo.length.should.equal(0);
// });

// test.skip("computed values are not saved", () => {
//   const { store } = makeViewStore();
//   store.getState().countSquared.should.equal(49);
//   // const current = store.getState().undoHistory.current as any; //?
//   // Object.keys(current).includes("countSquared").should.equal(false);
// });
