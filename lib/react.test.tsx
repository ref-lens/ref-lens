// @vitest-environment happy-dom

import { act, render, renderHook } from "@testing-library/react";
import React from "react";
import { useLens } from "./react";
import { Lens, makeLens } from "./lens";

test("subscribes to changes", () => {
  const lens = makeLens({ foo: { bar: { baz: 0 } } });
  const barLens = lens.prop("foo").prop("bar");
  const bazLens = barLens.prop("baz");

  const { result: barResult } = renderHook(() => useLens(barLens));
  const { result: bazResult } = renderHook(() => useLens(bazLens));

  const [barValueA, setBar] = barResult.current;
  const [bazValueA, setBaz] = bazResult.current;

  expect(barValueA.toJSON()).toEqual({ baz: 0 });
  expect(bazValueA).toEqual(0);

  act(() => {
    setBaz((prev) => prev + 1);
  });

  const [barValueB] = barResult.current;
  const [bazValueB] = bazResult.current;

  expect(barValueB.toJSON()).toEqual({ baz: 1 });
  expect(bazValueB).toEqual(1);

  act(() => {
    setBar((prev) => ({ baz: prev.baz + 1 }));
  });

  const [barValueC] = barResult.current;
  const [bazValueC] = bazResult.current;

  expect(barValueC.toJSON()).toEqual({ baz: 2 });
  expect(bazValueC).toEqual(2);
});

test("only re-renders values in a list if their lens value has changed", () => {
  let renderCount = 0;

  const lens = makeLens({ foo: [{ bar: 0 }, { bar: 5 }, { bar: 10 }] });

  const Child = React.memo((props: { lens: Lens<{ bar: number }> }) => {
    const [value] = useLens(props.lens);

    renderCount++;

    return <div>{value.bar}</div>;
  });

  const Parent = () => {
    const [value] = useLens(lens);

    return (
      <>
        {value.foo.map((item, index) => (
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

  const Loaded = (props: { lens: Lens<Loaded> }) => {
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

test("renders a list of values", () => {
  const lens = makeLens([{ value: 0 }, { value: 1 }, { value: 2 }]);

  const App = () => {
    const [proxy] = useLens(lens);

    return (
      <div data-testid="container">
        {proxy.map((item, index) => (
          <div key={item.value}>{item.value}</div>
        ))}
      </div>
    );
  };

  const { getByTestId } = render(<App />);

  expect(getByTestId("container").textContent).toEqual("012");

  act(() => lens.update((prev) => [...prev, { value: 3 }]));

  expect(getByTestId("container").textContent).toEqual("0123");

  act(() => lens.update((prev) => []));

  expect(getByTestId("container").textContent).toEqual("");
});

test("renders lenses from a list of lenses", () => {
  const lens = makeLens([{ foo: { value: 0 } }, { foo: { value: 1 } }, { foo: { value: 2 } }]);

  const App = () => {
    const [proxy] = useLens(lens);

    return (
      <div data-testid="container">
        {proxy.map((item, index) => (
          <Child key={index} lens={item.toLens()} />
        ))}
      </div>
    );
  };

  const Child = (props: { lens: Lens<{ foo: { value: number } }> }) => {
    const [proxy] = useLens(props.lens);

    return <div>{proxy.foo.value}</div>;
  };

  const { getByTestId } = render(<App />);

  expect(getByTestId("container").textContent).toEqual("012");

  act(() => lens.update((prev) => [...prev, { foo: { value: 3 } }]));

  expect(getByTestId("container").textContent).toEqual("0123");

  act(() => lens.update((prev) => []));

  expect(getByTestId("container").textContent).toEqual("");
});

test("limits re-rendering subscribed lens taht change their value", () => {
  const lens = makeLens([{ value: 0 }, { value: 1 }, { value: 2 }]);

  const logApp = vi.fn();
  const logChild = vi.fn();

  const App = () => {
    const [proxy] = useLens(lens);

    logApp(proxy.toJSON());

    return (
      <div data-testid="container">
        {proxy.map((item, index) => (
          <Child key={index} lens={item.toLens()} />
        ))}
      </div>
    );
  };

  const Child = React.memo((props: { lens: Lens<{ value: number }> }) => {
    const [proxy] = useLens(props.lens);

    logChild(proxy.value);

    return <div>{proxy.value}</div>;
  });

  const { getByTestId } = render(<App />);

  expect(getByTestId("container").textContent).toEqual("012");
  expect(logApp).toHaveBeenCalledTimes(1);
  expect(logChild).toHaveBeenCalledTimes(3);

  act(() =>
    lens
      .prop(1)
      .prop("value")
      .update((prev) => prev + 1)
  );

  expect(getByTestId("container").textContent).toEqual("022");
  expect(logApp).toHaveBeenCalledTimes(2);
  expect(logChild).toHaveBeenCalledTimes(4);

  act(() =>
    lens
      .prop(0)
      .prop("value")
      .update((prev) => prev + 1)
  );

  expect(getByTestId("container").textContent).toEqual("122");

  // noop shouldn't trigger a render
  act(() => lens.deepProp("0.value").update((prev) => prev));

  // noop shouldn't trigger a render
  act(() => lens.prop(0).update((prev) => prev));

  // noop shouldn't trigger a render
  act(() => lens.update((prev) => prev));

  // creating a new array will trigger a render because the reference changes
  act(() => lens.update((prev) => [...prev]));

  expect(logApp).toHaveBeenCalledTimes(4);
  expect(logApp).toHaveBeenNthCalledWith(1, [{ value: 0 }, { value: 1 }, { value: 2 }]);
  expect(logApp).toHaveBeenNthCalledWith(2, [{ value: 0 }, { value: 2 }, { value: 2 }]);
  expect(logApp).toHaveBeenNthCalledWith(3, [{ value: 1 }, { value: 2 }, { value: 2 }]);
  expect(logApp).toHaveBeenNthCalledWith(4, [{ value: 1 }, { value: 2 }, { value: 2 }]);

  expect(logChild).toHaveBeenCalledTimes(5);
  expect(logChild).toHaveBeenNthCalledWith(1, 0);
  expect(logChild).toHaveBeenNthCalledWith(2, 1);
  expect(logChild).toHaveBeenNthCalledWith(3, 2);
  expect(logChild).toHaveBeenNthCalledWith(4, 2);
  expect(logChild).toHaveBeenNthCalledWith(5, 1);
});

test("handles having the lens replaced", () => {
  const lensA = makeLens({ foo: { bar: 0 } });
  const lensB = makeLens({ foo: { bar: "hello" } });

  const Child = (props: { lens: Lens<string> | Lens<number> }) => {
    const [proxy] = useLens(props.lens);

    return <div data-testid="child-container">{proxy}</div>;
  };

  const App = () => {
    const [useB, setUseB] = React.useState(false);
    const lens = useB ? lensB : lensA;

    const [proxy] = useLens(lens);

    return (
      <div>
        <div data-testid="parent-container">{JSON.stringify(proxy.foo.toJSON())}</div>
        <button data-testid="button" onClick={() => setUseB(true)}>
          useB
        </button>
        <Child lens={lens.deepProp("foo.bar")} />
      </div>
    );
  };

  const { getByTestId } = render(<App />);
  const button = getByTestId("button");

  expect(getByTestId("parent-container").textContent).toEqual('{"bar":0}');
  expect(getByTestId("child-container").textContent).toEqual("0");

  act(() => button.click());

  expect(getByTestId("parent-container").textContent).toEqual('{"bar":"hello"}');
  expect(getByTestId("child-container").textContent).toEqual("hello");
});

test("can be configured to only render when a specific condition is met", () => {
  const lens = makeLens([{ value: 0 }, { value: 1 }, { value: 2 }]);

  const logApp = vi.fn();

  const App = () => {
    const [proxy] = useLens(lens, (prev, next) => prev.length !== next.length);

    logApp(proxy.toJSON());

    return null;
  };

  render(<App />);

  expect(logApp).toHaveBeenCalledTimes(1);

  act(() => lens.update((prev) => [...prev, { value: 3 }]));

  expect(logApp).toHaveBeenCalledTimes(2);

  act(() => lens.update((prev) => [...prev, { value: 4 }]));

  expect(logApp).toHaveBeenCalledTimes(3);

  act(() =>
    lens.update((prev) => {
      const [first, ...rest] = prev;
      return [{ value: first.value + 1 }, ...rest];
    })
  );

  expect(logApp).toHaveBeenCalledTimes(3);
});
