import "chai/register-should";
import _ from "lodash";
import { copyFiltered } from "../Utils";


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
