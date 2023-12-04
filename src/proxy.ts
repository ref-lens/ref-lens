import type { Lens } from "./lens";

type Scalar = string | number | bigint | boolean | null | undefined;

type Base<S extends object, A> = {
  toString(): string;
  toJSON(): A;
  toLens(): Lens<S, A>;
};

type ArrayLensProxy<S extends object, A extends any[]> = {
  [index: number]: LensProxy<S, A[number]>;
  [Symbol.iterator](): Iterator<LensProxy<S, A[number]>>;
  length: number;
} & Base<S, A>;

type ObjectLensProxy<S extends object, A extends object> = {
  [K in keyof A]: LensProxy<S, A[K]>;
} & Base<S, A>;

// prettier-ignore
export type LensProxy<S extends object, A> =
  A extends Scalar ? A :
  A extends any[] ? ArrayLensProxy<S, A> :
  A extends object ? ObjectLensProxy<S, A> :
  never;

const isScalar = <A>(value: A): value is A & Scalar => {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "boolean" ||
    value === null ||
    value === undefined
  );
};

const innerMake = <S extends object, A>(lens: Lens<S, A>): LensProxy<S, A> => {
  return new Proxy(function () {} as any, {
    apply(_target, thisArg, args) {
      return (lens.current as any).apply(thisArg, args);
    },
    get(_target, key0: string) {
      const key = key0 as keyof A;

      /**
       * React devtools introspection.
       */
      if (key === "$$typeof") {
        const a = lens.current as any;

        if (a.$$typeof !== undefined) {
          return a.$$typeof;
        }

        return undefined;
      }

      if (key === Symbol.toPrimitive) {
        return () => lens.current;
      }

      if (key === Symbol.iterator) {
        return function* () {
          for (const index in lens.current) {
            yield makeProxy(lens.prop(index));
          }
        };
      }

      if (key === "length") {
        const a = lens.current as any;
        const isArray = Array.isArray(a);

        if (isArray) {
          return a.length;
        } else if (a.length !== undefined) {
          return lens.prop("length" as keyof A);
        } else {
          return undefined;
        }
      }

      if (key === "toJSON") {
        return () => lens.current;
      }

      if (key === "toLens") {
        return () => lens;
      }

      if (key === "toString") {
        const a = lens.current as any;

        if (a.toString !== undefined) {
          return () => a.toString();
        } else {
          return undefined;
        }
      }

      return makeProxy(lens.prop(key));
    },

    ownKeys(_target) {
      // TODO add toJSON, toLens, toString
      return Reflect.ownKeys(lens.current as object);
    },

    // TODO - implement
  });
};

const cache = new WeakMap<Lens<any, any>, LensProxy<any, any>>();

export function makeProxy<S extends object, A extends Scalar>(lens: Lens<S, A>): A;
export function makeProxy<S extends object, A extends any[]>(lens: Lens<S, A>): ArrayLensProxy<S, A>;
export function makeProxy<S extends object, A extends object>(lens: Lens<S, A>): ObjectLensProxy<S, A>;
export function makeProxy<S extends object, A>(lens: Lens<S, A>): LensProxy<S, A>;

export function makeProxy<S extends object, A>(lens: Lens<S, A>) {
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

export const mapArray = <S extends object, A extends any[], B>(
  proxy: ArrayLensProxy<S, A>,
  fn: (item: LensProxy<S, A[number]>, index: number, array: ArrayLensProxy<S, A>) => B
): B[] => {
  const bs: B[] = [];

  for (let i = 0; i < proxy.length; i++) {
    const b = fn(proxy[i], i, proxy);
    bs.push(b);
  }

  return bs;
};

export const filterArray = <S extends object, A extends any[]>(
  proxy: ArrayLensProxy<S, A>,
  fn: (item: LensProxy<S, A[number]>, index: number, array: ArrayLensProxy<S, A>) => boolean
): Array<LensProxy<S, A[number]>> => {
  const result: Array<LensProxy<S, A[number]>> = [];

  for (let i = 0; i < proxy.length; i++) {
    const keep = fn(proxy[i], i, proxy);
    if (keep) result.push(proxy[i]);
  }

  return result;
};
