// @vitest-environment happy-dom

import { act, render, renderHook } from "@testing-library/react";
import { mapArray } from "./proxy";
import { Lens, makeLens } from "./lens";
import React from "react";
import { useLens } from "./react";

test("subscribes to changes", () => {
  const lens = makeLens({ foo: { bar: { baz: 0 } } });
  const barLens = lens.prop("foo").prop("bar");
  const bazLens = barLens.prop("baz");

  const { result: barResult } = renderHook(() => useLens(barLens));
  const { result: bazResult } = renderHook(() => useLens(bazLens));

  const [barValueA, barUpdate] = barResult.current;
  const [bazValueA, bazUpdate] = bazResult.current;

  expect(barValueA.toJSON()).toEqual({ baz: 0 });
  expect(bazValueA).toEqual(0);

  act(() => {
    bazUpdate((prev) => prev + 1);
  });

  const [barValueB] = barResult.current;
  const [bazValueB] = bazResult.current;

  expect(barValueB.toJSON()).toEqual({ baz: 1 });
  expect(bazValueB).toEqual(1);

  act(() => {
    barUpdate((prev) => ({ baz: prev.baz + 1 }));
  });

  const [barValueC] = barResult.current;
  const [bazValueC] = bazResult.current;

  expect(barValueC.toJSON()).toEqual({ baz: 2 });
  expect(bazValueC).toEqual(2);
});

test("only re-renders values in a list if their lens value has changed", () => {
  let renderCount = 0;

  const lens = makeLens({ foo: [{ bar: 0 }, { bar: 5 }, { bar: 10 }] });

  const Child = React.memo((props: { lens: Lens<any, { bar: number }> }) => {
    const [value] = useLens(props.lens);

    renderCount++;

    return <div>{value.bar}</div>;
  });

  const Parent = () => {
    const [value] = useLens(lens);

    return (
      <>
        {mapArray(value.foo, (item, index) => (
          <Child key={index} lens={item.toLens()} />
        ))}
      </>
    );
  };

  const { rerender } = render(<Parent />);

  expect(renderCount).toEqual(3);

  rerender(<Parent />);

  expect(renderCount).toEqual(3);

  act(() => {
    lens
      .prop("foo")
      .prop(0)
      .prop("bar")
      .update((prev) => prev + 1);
  });

  expect(renderCount).toEqual(4);

  act(() => {
    lens.prop("foo").update((arr) => {
      let [first, second, ...rest] = arr;

      first = { bar: first.bar + 1 };
      second = { bar: second.bar + 1 };

      return [first, second, ...rest];
    });
  });

  expect(renderCount).toEqual(6);
});

test("can handle discriminated union", () => {
  type Loading = { type: "loading" };
  type Loaded = { type: "loaded"; value: number };
  type State = Loading | Loaded;

  const lens = makeLens<State>({ type: "loaded", value: 0 });

  const logValue = vi.fn();

  const Loaded = (props: { lens: Lens<any, Loaded> }) => {
    const [proxy] = useLens(props.lens);

    logValue(proxy.value);

    return <div>Loaded: {proxy.value}</div>;
  };

  const Loading = () => <div>Loading...</div>;

  const App = () => {
    const [proxy] = useLens(lens);

    const child = proxy.type === "loaded" ? <Loaded lens={proxy.toLens()} /> : <Loading />;

    return <div data-testid="container">{child}</div>;
  };

  const { getByTestId } = render(<App />);

  expect(getByTestId("container").textContent).toEqual("Loaded: 0");
  expect(logValue).toHaveBeenCalledTimes(1);

  act(() => {
    lens.update(() => ({ type: "loading" }));
  });

  expect(getByTestId("container").textContent).toEqual("Loading...");
  expect(logValue).toHaveBeenCalledTimes(1);
});
