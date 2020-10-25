import { assert } from "chai";
import "chai/register-should";
import { action, Action, Computed, computed, createStore } from "easy-peasy";
import { undoRedo as undoRedoMiddleware } from "../UndoRedoMiddleware";
import { undoable, WithUndo } from "../UndoRedoState";
import { enableES5 } from "immer";

enableES5();

interface Model extends WithUndo {
  count: number;
  increment: Action<Model>;
}
const simpleModel: Model = undoable({
  count: 0,
  increment: action((state) => {
    state.count++;
  }),
});

interface ViewModel extends WithUndo {
  count: number;
  view: number;
  increment: Action<ViewModel>;
  doubleView: Action<ViewModel>;
  countSquared: Computed<ViewModel, number>;
}

const viewModel: ViewModel = undoable({
  count: 0,
  view: 7,
  doubleView: action((state) => {
    state.view *= 2;
  }),
  increment: action((state) => {
    state.count++;
  }),
  countSquared: computed([(model) => model.view], (view) => view * view),
});

function makeStore() {
  const store = createStore(undoable(simpleModel), {
    middleware: [undoRedoMiddleware()],
  });
  const actions = store.getActions();
  actions.undoSave();
  return { store, actions };
}

function makeViewStore() {
  const store = createStore(undoable(viewModel), {
    middleware: [undoRedoMiddleware({ noSaveKeys, noSaveActions })],
  });
  const actions = store.getActions();
  actions.undoSave();
  return { store, actions };
}

function noSaveKeys(key: string): boolean {
  return key === "view";
}

function noSaveActions(actionType: string): boolean {
  return actionType.startsWith("@action.doubleView");
}

test("save an action", () => {
  const { store, actions } = makeStore();
  actions.increment();
  (store.getState().undoHistory?.current as any).count.should.equal(1);
  store.getState().count.should.equal(1);
});

test("save two actions", () => {
  const { store, actions } = makeStore();
  actions.increment();
  actions.increment();
  const history = store.getState().undoHistory;
  (history.current as any).count.should.equal(2);
  (history.undo[0] as any).count.should.equal(0);
  history.undo.length.should.equal(2);
});

test("reset saved", () => {
  const { store, actions } = makeStore();
  actions.increment();
  actions.increment();
  actions.undoReset();
  const history = store.getState().undoHistory;
  history.redo.length.should.equal(0);
  history.undo.length.should.equal(0);
  const expectCount = store.getState().count;
  (history.current as any).count.should.equal(expectCount);
});

test("undo an action", () => {
  const { store, actions } = makeStore();
  actions.increment();
  actions.undoUndo();
  const history = store.getState().undoHistory;
  store.getState().count.should.equal(0);
  history.undo.length.should.equal(0);
});

test("undo two actions", () => {
  const { store, actions } = makeStore();
  actions.increment();
  actions.increment();
  actions.undoUndo();
  actions.undoUndo();
  const history = store.getState().undoHistory;
  store.getState().count.should.equal(0);
  history.undo.length.should.equal(0);
  (history.current as any).count.should.equal(0);
});

test("two actions, then undo", () => {
  const { store, actions } = makeStore();
  actions.undoReset();
  actions.increment();
  actions.increment();
  actions.undoUndo();
  const history = store.getState().undoHistory;
  store.getState().count.should.equal(1);
  history.undo.length.should.equal(1);
  history.redo.length.should.equal(1);
  (history.current as any).count.should.equal(1);
});

test("redo", () => {
  const { store, actions } = makeStore();
  actions.increment();
  actions.increment();
  actions.increment();
  store.getState().count.should.equal(3);
  actions.undoUndo();
  actions.undoUndo();
  store.getState().count.should.equal(1);
  actions.undoRedo();
  store.getState().count.should.equal(2);
  const history = store.getState().undoHistory;
  history.undo.length.should.equal(2);
  history.redo.length.should.equal(1);
  (history.current as any).count.should.equal(2);
});

test("undo empty doesn't crash", () => {
  const { actions } = makeStore();
  actions.undoUndo();
});

test("undo empty doesn't crash", () => {
  const { actions } = makeStore();
  actions.undoRedo();
});

test("don't save view keys", () => {
  const { actions } = makeStore();
});

test("views are not saved", () => {
  const { store } = makeViewStore();
  const history = store.getState().undoHistory;
  assert((history.current as any).view === undefined);
});

test("views are restored by undo/redo", () => {
  const { store, actions } = makeViewStore();
  actions.increment();
  actions.doubleView();
  actions.undoUndo();
  store.getState().view.should.equal(viewModel.view * 2);
});

test("views actions are not saved", () => {
  const { store, actions } = makeViewStore();
  actions.doubleView();
  store.getState().undoHistory.undo.length.should.equal(0);
});

test("computed values are not saved", () => {
  const { store, actions } = makeViewStore();
  store.getState().countSquared.should.equal(49);
  const current = store.getState().undoHistory.current as any; //?
  Object.keys(current).includes("countSquared").should.equal(false);
});
