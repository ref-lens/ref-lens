import React from "react";
import { UpdateFn, type Lens } from "./lens";
import { makeProxy, type LensProxy } from "./proxy";
import { ExtractLensType } from "./types";

type UseLensTuple<A> = [LensProxy<A>, UpdateFn<A>];

export const useLens = <L extends Lens<any>>(lens: L): UseLensTuple<ExtractLensType<L>> => {
  type Update = UpdateFn<ExtractLensType<L>>;

  const [, forceRender] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => lens.subscribe(forceRender), [lens]);

  const update = React.useCallback<Update>((fn) => lens.update(fn), [lens]);

  return [makeProxy(lens), update];
};
