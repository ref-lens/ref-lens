import React from "react";
import { type Lens } from "./lens";
import { makeProxy, type LensProxy } from "./proxy";

export const useLens = <A>(lens: Lens<A>): [LensProxy<A>, typeof lens.set, typeof lens.setAsync] => {
  /**
   * Can't use `useSyncExternalStore` because `lens` and the return
   * value of `proxyLensValue(lens)` both never change.
   */
  const [, forceRender] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => lens.subscribe(forceRender), [lens]);

  const set = React.useCallback<typeof lens.set>((fn) => lens.set(fn), [lens]);
  const setAsync = React.useCallback<typeof lens.setAsync>((fn) => lens.setAsync(fn), [lens]);

  return [makeProxy(lens), set, setAsync];
};
