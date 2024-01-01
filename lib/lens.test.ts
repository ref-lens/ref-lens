import { Lens, makeLens } from "./lens";

test("can get the current value", () => {
  const lens = makeLens({ foo: "bar" });

  expect(lens.current).toEqual({ foo: "bar" });
});

test("can update the root state", () => {
  const lens = makeLens({ foo: "bar" });

  lens.update(() => ({ foo: "baz" }));

  expect(lens.current).toEqual({ foo: "baz" });
});

test("can refine the lens", () => {
  const lens = makeLens({ foo: { bar: { baz: 0 } } });
  const bazLens = lens.deepProp("foo.bar.baz");

  bazLens.update((prev) => prev + 5);

  expect(lens.current).toEqual({ foo: { bar: { baz: 5 } } });
});

test("can subscribe to all changes", () => {
  const rootLens = makeLens({ foo: { bar: { baz: 0 } }, ping: { pong: "hello" } });

  const barLens = rootLens.deepProp("foo.bar");
  const bazLens = barLens.prop("baz");
  const pingLens = rootLens.prop("ping");
  const pongLens = pingLens.prop("pong");

  const rootSubscriber = vi.fn();
  const barSubscriber = vi.fn();
  const bazSubscriber = vi.fn();
  const pingSubscriber = vi.fn();
  const pongSubscriber = vi.fn();

  rootLens.subscribe(() => rootSubscriber(rootLens.current));
  barLens.subscribe(() => barSubscriber(barLens.current));
  bazLens.subscribe(() => bazSubscriber(bazLens.current));
  pingLens.subscribe(() => pingSubscriber(pingLens.current));
  pongLens.subscribe(() => pongSubscriber(pongLens.current));

  rootLens.update((prev) => ({ ...prev, foo: { bar: { baz: 5 } } }));
  bazLens.update(() => 10);
  pingLens.update(() => ({ pong: "world" }));
  bazLens.update(() => 10);
  rootLens.update((prev) => ({ ...prev, foo: { bar: { baz: 6 } } }));

  expect(rootSubscriber).toHaveBeenCalledTimes(4);
  expect(rootSubscriber).toHaveBeenNthCalledWith(1, {
    foo: { bar: { baz: 5 } },
    ping: { pong: "hello" },
  });
  expect(rootSubscriber).toHaveBeenNthCalledWith(2, {
    foo: { bar: { baz: 10 } },
    ping: { pong: "hello" },
  });
  expect(rootSubscriber).toHaveBeenNthCalledWith(3, {
    foo: { bar: { baz: 10 } },
    ping: { pong: "world" },
  });

  expect(barSubscriber).toHaveBeenCalledTimes(3);
  expect(barSubscriber).toHaveBeenNthCalledWith(1, { baz: 5 });
  expect(barSubscriber).toHaveBeenNthCalledWith(2, { baz: 10 });
  expect(barSubscriber).toHaveBeenNthCalledWith(3, { baz: 6 });

  expect(bazSubscriber).toHaveBeenCalledTimes(3);
  expect(bazSubscriber).toHaveBeenNthCalledWith(1, 5);
  expect(bazSubscriber).toHaveBeenNthCalledWith(2, 10);
  expect(bazSubscriber).toHaveBeenNthCalledWith(3, 6);

  expect(pingSubscriber).toHaveBeenCalledTimes(1);
  expect(pingSubscriber).toHaveBeenNthCalledWith(1, { pong: "world" });

  expect(pongSubscriber).toHaveBeenCalledTimes(1);
  expect(pongSubscriber).toHaveBeenNthCalledWith(1, "world");
});

test("with lists", () => {
  const rootLens = makeLens({ foo: { bar: [123] } });
  const fooLens = rootLens.prop("foo");
  const barLens = fooLens.prop("bar");
  const firstBarLens = barLens.prop(0);

  const barSubscriber = vi.fn();
  const fooSubscriber = vi.fn();
  const firstBarSubscriber = vi.fn();

  barLens.subscribe(() => barSubscriber(barLens.current));
  fooLens.subscribe(() => fooSubscriber(fooLens.current));
  firstBarLens.subscribe(() => firstBarSubscriber(firstBarLens.current));

  rootLens.update((prev) => {
    return {
      ...prev,
      foo: {
        bar: [789, ...prev.foo.bar],
      },
    };
  });
  fooLens.update(() => ({ bar: [] }));
  firstBarLens.update(() => 456);

  expect(barSubscriber).toHaveBeenCalledTimes(3);
  expect(barSubscriber).toHaveBeenNthCalledWith(1, [789, 123]);
  expect(barSubscriber).toHaveBeenNthCalledWith(2, []);
  expect(barSubscriber).toHaveBeenNthCalledWith(3, [456]);

  expect(firstBarSubscriber).toHaveBeenCalledTimes(3);
  expect(firstBarSubscriber).toHaveBeenNthCalledWith(1, 789);
  expect(firstBarSubscriber).toHaveBeenNthCalledWith(2, undefined);
  expect(firstBarSubscriber).toHaveBeenNthCalledWith(3, 456);
});

test("can handle descriminted unions", () => {
  type Loading = { type: "loading" };
  type Loaded = { type: "loaded"; value: number };
  type State = Loading | Loaded;

  const lens = makeLens<State>({ type: "loaded", value: 0 });
  const typeLens = lens.prop("type");
  const valueLens = lens.prop("value" as any);

  const typeSubscriber = vi.fn();
  const valueSubscriber = vi.fn();

  typeLens.subscribe(() => typeSubscriber(typeLens.current));
  valueLens.subscribe(() => valueSubscriber(valueLens.current));

  lens.update(() => ({ type: "loading" }));
  lens.update(() => ({ type: "loaded", value: 1 }));
  lens.update(() => ({ type: "loading" }));

  expect(typeSubscriber).toHaveBeenCalledTimes(3);
  expect(typeSubscriber).toHaveBeenNthCalledWith(1, "loading");
  expect(typeSubscriber).toHaveBeenNthCalledWith(2, "loaded");
  expect(typeSubscriber).toHaveBeenNthCalledWith(3, "loading");

  expect(valueSubscriber).toHaveBeenCalledTimes(3);
  expect(valueSubscriber).toHaveBeenNthCalledWith(1, undefined);
  expect(valueSubscriber).toHaveBeenNthCalledWith(2, 1);
  expect(valueSubscriber).toHaveBeenNthCalledWith(3, undefined);
});

test("does not affect lenses of iterables when the value is removed", () => {
  const lens = makeLens([{ foo: 1 }, { foo: 2 }]);
  const lens0 = lens.prop(0);

  expect(lens0.current.foo).toBe(1);

  lens.update(() => []);

  expect(lens0.current).toBe(undefined);

  lens.update(() => [{ foo: 3 }]);

  expect(lens0.current.foo).toBe(3);
});

test("does not affect subscribers of iterables when the value is removed", () => {
  const lens = makeLens([{ foo: 1 }, { foo: 2 }]);
  const lens0 = lens.prop(0);

  const subscriber = vi.fn();

  lens0.subscribe(() => subscriber(lens0.current));

  lens.update((prev) => [{ foo: 3 }, ...prev]);
  lens.update(([first, ...rest]) => [{ ...first, foo: 10 }, ...rest]);
  lens.update(() => []);

  expect(subscriber).toHaveBeenCalledTimes(3);
  expect(subscriber).toHaveBeenNthCalledWith(1, { foo: 3 });
  expect(subscriber).toHaveBeenNthCalledWith(2, { foo: 10 });
  expect(subscriber).toHaveBeenNthCalledWith(3, undefined);
});

test("does not update an empty value", () => {
  const lens = makeLens([{ foo: { value: 1 } }, { foo: { value: 2 } }]);
  const lens0 = lens.prop(0);
  const lens1 = lens.prop(1);
  const lens0Foo = lens.deepProp("0.foo");

  const subscriber = vi.fn();

  lens0.subscribe(() => subscriber(lens0.current));

  lens.update(() => []);

  /**
   * Should not be called because there is no value.
   */
  lens0Foo.update((prev) => ({ ...prev, value: 10 }));

  expect(subscriber).toHaveBeenCalledTimes(1);
  expect(subscriber).toHaveBeenNthCalledWith(1, undefined);

  expect(lens.current).toEqual([]);

  lens1.update((prev) => ({ ...prev, foo: { value: 10 } }));

  expect(lens.current).toEqual([undefined, { foo: { value: 10 } }]);
});

test("can deeply get props inside of arrays", () => {
  const lens = makeLens({ foo: { bar: { baz: [{ haha: 1 }] } } });

  expect(lens.deepProp("foo.bar.baz").current).toEqual([{ haha: 1 }]);
  expect(lens.deepProp("foo.bar.baz.0.haha").current).toEqual(1);
});

test("can cast a union of lenses into a single lens", () => {
  type LoadingState = { type: "loading" };
  type LoadedState = { type: "loaded"; value: number };
  type StateLens = Lens<LoadingState> | Lens<LoadedState>;

  function refineTypeWithoutCasting(lens: StateLens) {
    // @ts-expect-error
    return lens.prop("type");
  }

  function refineTypeWithCasting(lens: StateLens) {
    return Lens.castUnion(lens).prop("type");
  }

  const lens = makeLens<LoadingState>({ type: "loading" });

  expect(refineTypeWithoutCasting(lens).current).toBe("loading");
  expect(refineTypeWithCasting(lens).current).toBe("loading");
});
