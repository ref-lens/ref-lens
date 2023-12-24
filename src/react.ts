import React from "react";
import { LensSet, type Lens } from "./lens";
import { makeProxy, type LensProxy } from "./proxy";

type ExtractLens<A> = A extends Lens<infer A1> ? A1 : never;

type UseLensTuple<A> = [LensProxy<A>, LensSet<A>];

export function useLens<A extends Lens<any>>(lens: A): UseLensTuple<ExtractLens<A>> {
  const [, forceRender] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => lens.subscribe(forceRender), [lens]);

  const set = React.useCallback<typeof lens.set>((fn) => lens.set(fn), [lens]);

  return [makeProxy(lens), set];
}
