import { makeLens } from "./lens";
import { filterArray, makeProxy, mapArray } from "./proxy";

test("wraps children in lenses", () => {
  const lens = makeLens({ foo: "bar" });
  const proxy = makeProxy(lens);
  expect(proxy.foo).toEqual("bar");
});

test("works with Array.from", () => {
  const lens = makeLens(["foo", "bar"]);
  const proxy = makeProxy(lens);

  const [foo, bar] = Array.from(proxy);

  expect(foo).toEqual("foo");
  expect(bar).toEqual("bar");
});

test("can iterate a list and return values to a lens", () => {
  const lens = makeLens(["foo", "bar"]);
  const proxy = makeProxy(lens);

  const result: string[] = [];

  for (const item of proxy) {
    result.push(item);
  }

  expect(result).toEqual([lens.refine(0).current, lens.refine(1).current]);
});

test("can transform back into the same lens", () => {
  const lens = makeLens({ foo: "bar" });
  const proxy = makeProxy(lens);
  expect(proxy.toLens()).toBe(lens);
});

test("scalars are not wrapped in proxies", () => {
  const lens = makeLens({ foo: "bar" });
  const proxy = makeProxy(lens);

  expect(proxy.foo).toBe(lens.refine("foo").current);
});

test("can be converted into a primitive", () => {
  const lens = makeLens({ foo: 5 });
  const proxy = makeProxy(lens);

  expect(proxy.foo + 10).toEqual(15);
  expect(10 + proxy.foo).toEqual(15);
  expect(proxy.foo + "10").toEqual("510");
  expect("10" + proxy.foo).toEqual("105");
  expect(proxy.foo.toString()).toEqual("5");
});

test("can map objects in arrays", () => {
  const lens = makeLens([{ foo: "bar" }]);
  const proxy = makeProxy(lens);

  const result = mapArray(proxy, (item) => item.foo);
  const expected = proxy[0].foo;

  expect(result[0]).toBe(expected);
});

test("can map arrays in arrays", () => {
  const lens = makeLens([["foo", "bar"]]);
  const proxy = makeProxy(lens);

  const result = mapArray(proxy, (item) => Array.from(item));
  const expected = Array.from(proxy[0]);

  expect(result[0]).toEqual(expected);
});

test("can map arrays in objects", () => {
  const lens = makeLens({ foo: ["bar", "baz"] });
  const proxy = makeProxy(lens);

  const result = mapArray(proxy.foo, (item) => item);
  const expected = Array.from(proxy.foo);

  expect(result).toEqual(expected);
});

test("can filter objects in arrays", () => {
  const lens = makeLens([{ foo: "bar" }, { foo: "baz" }]);
  const proxy = makeProxy(lens);

  const resultA = filterArray(proxy, (item) => item.foo === "bar" || item.foo === "bif");

  expect(resultA.length).toBe(1);

  lens.update((prev) => prev.concat({ foo: "bif" }));

  const resultB = filterArray(proxy, (item) => item.foo === "bar" || item.foo === "bif");

  expect(resultB.length).toBe(2);
});

test("keeps the same lens reference through iteration", () => {
  const lens = makeLens([{ foo: "bar" }, { foo: "baz" }]);
  const proxy = makeProxy(lens);

  const result = mapArray(proxy, (item) => item.toLens());

  expect(lens.refine(0)).toBe(result[0]);
  expect(lens.refine(1)).toBe(result[1]);
});

test("keeps the same reference to an index when the list is updated", () => {
  const lens = makeLens([{ foo: "bar" }, { foo: "baz" }]);
  const lens0 = lens.refine(0);
  const proxy = makeProxy(lens0);

  expect(proxy.foo).toBe("bar");

  lens.update((prev) => [{ foo: "bif", ...prev }]);

  expect(proxy.foo).toBe("bif");
});

test("reacts to mutated objects", () => {
  const lens = makeLens({ foo: ["bar"] });
  const fooLens = lens.refine("foo");
  const proxy = makeProxy(lens);

  expect(proxy.foo.toLens()).toBe(fooLens);
  expect(proxy.foo.toJSON()).toEqual(["bar"]);

  fooLens.update((prev) => prev.concat("baz"));

  expect(proxy.foo.toJSON()).toEqual(["bar", "baz"]);
});

test("can proxy scalar values", () => {
  const lens = makeLens({ foo: { bar: { baz: 0 } } });
  const bazLens = lens.refine("foo").refine("bar").refine("baz");

  const proxy = makeProxy(bazLens);

  expect(proxy === 0).toBe(true);
});

test("can descriminate a union back into a lens", () => {
  type A = { type: "a"; foo: string };
  type B = { type: "b"; bar: number };
  type AorB = A | B;

  const lens = makeLens<AorB>({ type: "a", foo: "bar" });
  const proxy = makeProxy(lens);

  // @ts-expect-error
  lens.refine("foo");

  if (proxy.type === "b") {
    proxy.toLens().refine("bar");

    // @ts-expect-error
    proxy.toLens().refine("foo");
  }

  if (proxy.type === "a") {
    const fooLens = proxy.toLens().refine("foo");

    expect(fooLens.current).toBe("bar");
    expect(proxy.foo).toBe("bar");

    // @ts-expect-error
    proxy.toLens().refine("bar");
  }
});
