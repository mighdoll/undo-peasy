import { assert } from "chai";
import "chai/register-should";
import {
  action,
  Action,
  ActionMapper,
  computed,
  Computed,
  createStore,
  State,
  Store,
  ValidActionProperties,
} from "easy-peasy";
import { enableES5 } from "immer";
import { HistoryStore } from "../HistoryStore";
import { undoRedo as undoRedoMiddleware } from "../Middleware";
import {
  HistoryOptions,
  ModelWithUndo,
  undoableModelAndHistory,
} from "../Actions";
import { AnyObject, findModelComputeds } from "../Utils";
import { AnyAction } from "redux";

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
  viewDeep: { a: number };
  increment: Action<ViewModel>;
  doubleView: Action<ViewModel>;
  doubleDeepView: Action<ViewModel>;
  countSquared: Computed<ViewModel, number>;
}

const viewModel: ViewModel = {
  count: 0,
  view: 7,
  viewDeep: { a: 9 },
  doubleView: action((state) => {
    state.view *= 2;
  }),
  doubleDeepView: action((state) => {
    state.viewDeep.a *= 2;
  }),
  increment: action((state) => {
    state.count++;
  }),
  countSquared: computed([(model) => model.view], (view) => view * view),
};

interface StoreAndHistory<M extends AnyObject> {
  store: Store<M>;
  actions: ActionMapper<
    ModelWithUndo<M>,
    ValidActionProperties<ModelWithUndo<M>>
  >;
  history: HistoryStore;
}

function withStore(
  fn: (storeAndHistory: StoreAndHistory<Model>) => void,
  historyOptions?: HistoryOptions<Model>,
  noReset?: boolean
) {
  const { model, history } = undoableModelAndHistory(
    simpleModel,
    historyOptions
  );
  history._erase();
  const store = createStore(model, {
    middleware: [undoRedoMiddleware()],
  });
  const actions = store.getActions();
  if (!noReset) {
    actions.undoReset();
  }
  try {
    fn({ store, actions, history });
  } finally {
    history._erase();
  }
}

function withViewStore(
  fn: (storeAndHistory: StoreAndHistory<ViewModel>) => void
) {
  const { model, history } = undoableModelAndHistory(viewModel, {
    noSaveKeys: viewKeys,
  });
  const store = createStore(model, {
    middleware: [undoRedoMiddleware()],
  });
  const actions = store.getActions();
  try {
    fn({ store, actions, history });
  } finally {
    history._erase();
  }
}

function viewKeys(key: string): boolean {
  return key === "view" || key === "viewDeep";
}

function historyExpect(
  history: HistoryStore,
  expectLength: number,
  expectIndex: number
): void {
  const index = history._currentIndex()!;
  const length = history._allSaved().length;
  length.should.equal(expectLength, "history length");
  index.should.equal(expectIndex);
}

test("undo, no reset first", () => {
  withStore(
    ({ store, actions, history }) => {
      actions.increment();
      actions.undoUndo();

      store.getState().count.should.equal(0);
    },
    undefined,
    true
  );
});

test("zero state filters views", () => {
  withViewStore(({ history, actions }) => {
    actions.increment();
    history._currentIndex().should.equal(1);
    history._getState(0); 
    expect(history._getState(0)?.view).toBeUndefined;
  });
});

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

test("manual save", () => {
  withStore(
    ({ store, history, actions }) => {
      store.getState().count = 7; // cheat and manually modify state
      actions.undoSave(); // verify that it's ok to call w/o parameters

      store.getState().count.should.equal(7);
      historyExpect(history, 1, 0);
    },
    undefined,
    true
  );
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

test("don't save duplicate state", () => {
  withStore(({ store, history, actions }) => {
    actions.increment();
    store.getState().count.should.equal(1);
    actions.undoSave({ action: { type: "do_nada" }, prevState: {} });

    historyExpect(history, 2, 1);
  });
});

test("redo", () => {
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

    historyExpect(history, 4, 2);
  });
});

test("redo unavailable", () => {
  withStore(({ store, history, actions }) => {
    actions.increment();
    store.getState().count.should.equal(1);
    historyExpect(history, 2, 1);
    actions.undoRedo();
    store.getState().count.should.equal(1);

    historyExpect(history, 2, 1);
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

test("views are not saved", () => {
  withViewStore(({ history }) => {
    const savedView = history._getState(0)?.view;

    assert(savedView === undefined);
  });
});

test("views actions are not saved", () => {
  withViewStore(({ actions, history }) => {
    actions.doubleView();

    historyExpect(history, 2, 1);
  });
});

test("deep view actions are not saved", () => {
  withViewStore(({ actions, history }) => {
    actions.doubleDeepView();

    historyExpect(history, 2, 1);
  });
});

test("computed values are not saved", () => {
  withViewStore(({ store, actions, history }) => {
    store.getState().countSquared.should.equal(49);
    actions.increment();
    const savedState = history._getState(1)!;
    Object.keys(savedState).includes("countSquared").should.equal(false);
  });
});

test("maxHistory can simply limit size", () => {
  withStore(
    ({ actions, history }) => {
      actions.increment();
      history._currentIndex()!.should.equal(1);
      history._oldestIndex()!.should.equal(0);
      expect(history._getState(0)).toBeDefined();
      actions.increment();
      history._currentIndex()!.should.equal(2);
      expect(history._getState(0)).toBeUndefined();
      history._oldestIndex()!.should.equal(1);
    },
    { maxHistory: 2 }
  );
});

test("maxHistory works with redo too", () => {
  withStore(
    ({ actions, history }) => {
      actions.increment();
      actions.increment();
      actions.undoUndo();
      actions.undoUndo();
      historyExpect(history, 3, 0);
      actions.increment();
      actions.increment();
      actions.increment();
      historyExpect(history, 3, 3);
      expect(history._getState(0)).toBeUndefined();
      history._oldestIndex()!.should.equal(1);
    },
    { maxHistory: 3 }
  );
});

test("findModelComputeds", () => {
  findModelComputeds(viewModel).should.deep.equal([["countSquared"]]);
});

test("actionStateFilter", () => {
  withStore(
    ({ actions, history }) => {
      actions.increment();
      historyExpect(history, 2, 1);
      actions.increment();
      historyExpect(history, 3, 2);
      actions.increment();
      historyExpect(history, 3, 2);
    },
    { skipAction }
  );

  function skipAction(state: State<Model>, action: AnyAction): boolean {
    action.type.should.equal("@action.increment");
    if (state.count > 2) {
      return true;
    }
    return false;
  }
});

test("group Undo", () => {
  withStore(({ actions, history }) => {
    actions.undoGroupStart();
    actions.increment();
    actions.increment();
    actions.undoGroupComplete();
    historyExpect(history, 2, 1);
    (history._getState(1) as Model).count.should.equal(2);
  });
});

test("actionStateFilter with group Undo", () => {
  withStore(
    ({ actions, history }) => {
      actions.undoGroupStart();
      actions.increment();
      actions.increment();
      actions.undoGroupComplete();
      historyExpect(history, 1, 0);
      (history._getState(0) as Model).count.should.equal(0);
    },
    { skipAction }
  );

  function skipAction(state: State<Model>, action: AnyAction): boolean {
    action.type.should.equal("@action.undoGroupComplete");
    state.count.should.equal(2);
    return true;
  }
});

test("group Ignore", () => {
  withStore(({ actions, history }) => {
    actions.undoGroupStart();
    actions.increment();
    actions.increment();
    actions.undoGroupIgnore();
    actions.increment();
    history._currentIndex();
    historyExpect(history, 2, 1);
    (history._getState(1) as Model).count.should.equal(3);
  });
});
