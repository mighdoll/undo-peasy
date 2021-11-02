import _ from "lodash";

type ObjOrArray = object | Array<any>;

/** Return a copy of an object with some fields elided.
 *
 * @param fn skip properties for which this function returns true
 */
export function copyFiltered(
  src: ObjOrArray,
  fn: (value: any, key: string, path: string[]) => boolean
): ObjOrArray {
  return filterCopyRecurse(src, []);

  function filterCopyRecurse(obj: ObjOrArray, path: string[]): ObjOrArray {
    if (_.isArray(obj)) {
      return obj.map((elem) => filterCopyRecurse(elem, path));
    }

    if (_.isObject(obj)) {
      const filtered = Object.entries(obj).filter(
        ([key, value]) => !fn(value, key, path)
      );
      const copies = filtered.map(([key, value]) => [
        key,
        filterCopyRecurse(value, path.concat([key])),
      ]);
      return Object.fromEntries(copies);
    }

    return obj;
  }
}

/** replace undefined fields with a default value */
export function replaceUndefined<T extends Partial<U>, U>(
  obj: T,
  defaults: U
): T & U {
  const result = { ...defaults, ...removeUndefined(obj) };
  return result;
}

/** @return a copy, eliding fields with undefined values */
export function removeUndefined<T>(obj: T): T {
  const result = { ...obj };
  for (const key in result) {
    if (result[key] === undefined) {
      delete result[key];
    }
  }
  return result;
}

export interface AnyObject {
  [key: string]: any;
}

/** @return the paths of all computed properties nested in an easy peasy model instance */
export function findModelComputeds(
  src: AnyObject,
  pathPrefix: string[] = []
): string[][] {
  const result = Object.entries(src).flatMap(([key, value]) => {
    if (isComputedField(value)) {
      
      const getter = [pathPrefix.concat([key])];
      return getter;
    } else if (_.isPlainObject(value)) {
      return findModelComputeds(value, pathPrefix.concat([key]));
    } else {
      return [];
    }
  });
  return result;
}

export const computedSymbol = "$_c";

function isComputedField(value: unknown): boolean {
  if (_.isPlainObject(value)) {
    return (value as AnyObject)[computedSymbol] !== undefined;
  } else {
    return false;
  }
}
