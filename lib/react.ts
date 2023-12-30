import React from "react";
import { UpdateFn, type Lens } from "./lens";
import { makeProxy, type LensProxy } from "./proxy";

type ExtractLensType<A> = A extends Lens<infer A1> ? A1 : never;
type UseLensTuple<A> = [LensProxy<A>, UpdateFn<A>];

export function useLens<L extends Lens<any>>(lens: L): UseLensTuple<ExtractLensType<L>> {
  const [, forceRender] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => lens.subscribe(forceRender), [lens]);

  const update = React.useCallback<typeof lens.update>((fn) => lens.update(fn), [lens]);

  return [makeProxy(lens), update];
}
