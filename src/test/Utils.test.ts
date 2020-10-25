import "chai/register-should";
import _ from "lodash";
import { findGetters, copyFiltered } from "../Utils";


test("findGetters", () => {
  const src = {
    get foo() {return 7},
    hoo: "hood",
    bar: {
      get gogo() {return 9;},
      boo: "bood"
    }
  }
  const getters = findGetters(src);
  const getterPaths = getters.map(path => path.join("."));//?
  getterPaths.includes("foo").should.be.true;
  getterPaths.includes("bar.gogo").should.be.true;
});

test("remove functions", () => {
  const src: any = {
    foo: "bar",
    deep: { fi: "fi" },
    deepArray: [{ fo: "fo" }],
  };
  const withFun = _.cloneDeep(src);
  withFun.fun = () => {};
  withFun.deep.fun = () => {};
  withFun.deepArray[0].fun = () => {};
  withFun.should.deep.not.equal(src);

  const filtered = copyFiltered(withFun, _.isFunction);
  filtered.should.deep.equal(src);
  filtered.should.not.equal(src);
});
