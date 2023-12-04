import React from "react";
import { type Lens } from "./lens";
import { makeProxy, type LensProxy } from "./proxy";

export const useLens = <A>(
  lens: Lens<any, A>
): [LensProxy<any, A>, (fn: (prev: A) => A) => void] => {
  /**
   * Can't use `useSyncExternalStore` because `lens` and the return
   * value of `proxyLensValue(lens)` both never change.
   */
  const [, forceRender] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => lens.subscribe(forceRender), [lens]);

  const update = React.useCallback(
    (fn: (prev: A) => A) => lens.update(fn),
    [lens]
  );

  return [makeProxy(lens), update];
};
