import type { Lens } from "./lens";

type Scalar = string | number | bigint | boolean | null | undefined;

type BaseProxy<A> = {
  toJSON(): A;
  toLens(): Lens<A>;
};

type ArrayLensProxy<A extends any[]> = Array<LensProxy<A[number]>> & BaseProxy<A>;

type ObjectLensProxy<A extends object> = {
  [K in keyof A]: LensProxy<A[K]>;
} & BaseProxy<A>;

// prettier-ignore
export type LensProxy<A> =
  A extends Scalar ? A :
  A extends any[] ? ArrayLensProxy<A> :
  A extends object ? ObjectLensProxy<A> :
  never;

const isScalar = <A>(value: A): value is A & Scalar => {
  const type = typeof value;

  return (
    type === "string" ||
    type === "number" ||
    type === "bigint" ||
    type === "boolean" ||
    value === null ||
    value === undefined
  );
};

const innerMake = <A>(lens: Lens<A>): LensProxy<A> => {
  return new Proxy((() => lens.current) as any, {
    apply(target, thisArg, args) {
      return target().apply(thisArg, args);
    },

    get(target, key0: string) {
      const key = key0 as keyof A;

      /**
       * React devtools introspection.
       */
      if (key === "$$typeof") {
        const a = target();

        if ("$$typeof" in a) {
          return a.$$typeof;
        }

        return undefined;
      }

      if (key === "toJSON") {
        return target;
      }

      if (key === "toLens") {
        return () => lens;
      }

      return makeProxy(lens.prop(key));
    },

    ownKeys(target) {
      return Reflect.ownKeys(target());
    },

    getOwnPropertyDescriptor(target, key) {
      const desc = Reflect.getOwnPropertyDescriptor(target(), key);
      if (desc) {
        desc.configurable = true;
      }
      return desc;
    },

    set() {
      return false;
    },

    deleteProperty() {
      return false;
    },

    defineProperty() {
      return false;
    },

    has(target, key) {
      return Reflect.has(target(), key);
    },

    isExtensible() {
      return false;
    },

    preventExtensions() {
      return false;
    },

    getPrototypeOf() {
      return null;
    },

    setPrototypeOf() {
      return false;
    },
  });
};

const cache = new WeakMap<Lens<any>, LensProxy<any>>();

export function makeProxy<A extends Scalar>(lens: Lens<A>): A;
export function makeProxy<A>(lens: Lens<A>): LensProxy<A>;
export function makeProxy<A>(lens: Lens<A>) {
  const a = lens.current;

  if (isScalar(a)) {
    return a;
  }

  let proxy = cache.get(lens);

  if (!proxy) {
    proxy = innerMake(lens);
    cache.set(lens, proxy);
  }

  return proxy;
}
