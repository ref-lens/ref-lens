import React from "react";
import { UpdateFn, type Lens } from "./lens";
import { makeProxy, type LensProxy } from "./proxy";
import { ExtractLensType } from "./types";

type UseLensTuple<A> = [LensProxy<A>, UpdateFn<A>];

type ShouldTriggerRenderFn<A> = (prev: A, next: A) => boolean;

const notDefined = Symbol();

/**
 *
 * @param lens The lens to use.
 * @param shouldTriggerRender A function that determines whether the component should render when the lens value changes. By default, triggers a render whenever the value changes, but can be configured to only trigger a render when a specific value changes. For example, only rendering when the length of an array changes.
 * @returns
 */
export const useLens = <L extends Lens<any>>(
  lens: L,
  shouldTriggerRender: ShouldTriggerRenderFn<ExtractLensType<L>> = () => true
): UseLensTuple<ExtractLensType<L>> => {
  type A = ExtractLensType<L>;
  type Update = UpdateFn<A>;

  const [, forceRender] = React.useReducer((prev) => prev + 1, 0);

  /**
   * Make sure that we don't call `lens.current` more than we have to by
   * initializing `prevRef` as a unique symbol and then setting it to
   * `lens.current` on the first render.
   */
  const prevRef = React.useRef<A>(notDefined as A);

  if (prevRef.current === notDefined) {
    prevRef.current = lens.current;
  }

  React.useEffect(
    () =>
      lens.subscribe(() => {
        const prev = prevRef.current;
        const next = lens.safeCurrent();

        if (!next.success) return;

        const should = shouldTriggerRender(next.value, prev);

        prevRef.current = next.value;

        if (should) {
          forceRender();
        }
      }),
    [lens]
  );

  const update = React.useCallback<Update>((fn) => lens.update(fn), [lens]);

  return [makeProxy(lens), update];
};
