import _ from "lodash";

type ObjOrArray = object | Array<any>;

/** return a copy of an object with fields removed by a filter function */
export function removeDeep(
  src: ObjOrArray,
  fn: (value: any, key: string, path: string[]) => boolean
): ObjOrArray {
  return removeRecursive(src, []);

  function removeRecursive(obj: ObjOrArray, path: string[]): ObjOrArray {
    if (_.isArray(obj)) {
      return obj.map((elem) => removeDeep(elem, fn));
    }

    if (_.isObject(obj)) {
      const filtered = Object.entries(obj).filter(
        ([key, value]) => !fn(value, key, path)
      );
      const copies = filtered.map(([key, value]) => [
        key,
        removeRecursive(value, path.concat([key])),
      ]);
      return Object.fromEntries(copies);
    }

    return obj;
  }
}

/** replace undefined fields with a default value */
export function replaceUndefined<T extends Partial<U>, U>(obj: T, defaults: U): T & U {
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

export function findGetters(src: AnyObject, pathPrefix: string[] = []): string[][] {
  const result = Object.entries(src).flatMap(([key, value]) => {
    if (isGetter(src, key)) {
      const getter = [pathPrefix.concat([key])];
      return getter;
    } else if (_.isPlainObject(value)) {
      const found = findGetters(value, pathPrefix.concat([key]));
      return found;
    } else {
      return [];
    }
  });
  return result;
}


function isGetter(src: {}, key: string): boolean {
  const desc = Object.getOwnPropertyDescriptor(src, key);
  if (desc && desc.get) {
    return true;
  }
  return false;
}