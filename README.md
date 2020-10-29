Undo/Redo support for [easy peasy](https://easy-peasy.now.sh/).

_`undo-peasy` depends on a version of easy-peasy at least 4.1.0. It's currently
tested with 4.1.0-beta.4 _

## Usage

1. Attach `undoRedoMiddleWare` in `createStore`.
    ```
    const store = createStore(appModel, {
      middleware: [undoRedo()],
    });
    ```
1. If using typescript, the root application model should extend `WithUndo`. 
`WithUndo` will add types for undo actions and undo history to your root model.
    ```
      interface Model extends WithUndo {
        count: number;
        increment: Action<Model>;
      }
    ```
1. Wrap the root application instance in `undoable`. 
`undoable()` will make undo actions available on your root model.
    ```
    const appModel: Model = undoable({
      count: 0,
      increment: action((state) => {
        state.count++;
      }),
    });
    ```
1. Profit
    ```
    const undoAction = useStoreActions((actions) => actions.undoUndo);
    ```


## Supported Actions
* **`undoUndo`** - restore state to the most recently saved version.
* **`undoRedo`** - restore state to the most recently undone version.
* `undoReset` - erases saved undo/redo history and saves the current state.
* `undoSave` - save current application state to undo history. 
undoSave is generated automatically by the middleware, but in rare cases it's useful to save manually.

## Configuration
The `undoRedo()` middleware function accepts an optional configuration object.
* `noSaveActions` - a function that tells undoRedo to not save certain actions to undo/redo history.
* `noSaveKeys` - a function tthat tells undoRedo not to save certain keys inside the state model 
to undo/redo history. e.g. view state in the model.
