import React from "react";
import { type Lens } from "./lens";
import { makeProxy, type LensProxy } from "./proxy";

export const useLens = <A>(lens: Lens<A>): [LensProxy<A>, (fn: (prev: A) => A) => void] => {
  /**
   * Can't use `useSyncExternalStore` because `lens` and the return
   * value of `proxyLensValue(lens)` both never change.
   */
  const [, forceRender] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => lens.subscribe(forceRender), [lens]);

  const setter = React.useCallback((fn: (prev: A) => A) => lens.set(fn), [lens]);

  return [makeProxy(lens), setter];
};
