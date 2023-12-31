import type { Paths } from "type-fest";

// prettier-ignore
type GetDeep<T, K extends string> = 
  K extends keyof T ? T[K] :
  K extends `${number}` ? (T extends any[] ? T[number] : never) :
  K extends `${number}.${infer Rest}` ? (T extends any[] ? GetDeep<T[number], Rest> : never) :
  K extends `${infer First}.${infer Rest}` ? (First extends keyof T ? GetDeep<T[First], Rest> : never) :
  never;

type Subscriber = () => void;
type Unsubscribe = () => void;

type GetFn<S, A> = (state: S) => A;
type SetFn<S, A> = (state: S, value: A) => S;
export type UpdateFn<A> = (fn: (prev: A) => A) => void;

type MutableRefObject<S> = {
  current: S;
};

type Parent = {
  notifyUp(): void;
};

export type Lens<A> = {
  /**
   * Gets the current value of the lens.
   */
  get current(): A;
  /**
   * Refines the lens by a single property.
   * @param key The property key.
   */
  refine<K extends keyof A>(key: K): Lens<A[K]>;
  /**
   * Deeply refines the lens by a property key path.
   * @param keyPath The property key path.
   */
  refineDeep<K extends Paths<A> & string>(keyPath: K): Lens<GetDeep<A, K>>;
  /**
   * Updates the value of the root reference at the current refinement.
   * @param fn A function that receives the previous value and returns the next value.
   */
  update: UpdateFn<A>;
  /**
   * Subscribes to changes to the lens.
   * @param fn A function that is called when the lens changes.
   * @returns A function that can be called to unsubscribe.
   */
  subscribe(fn: Subscriber): Unsubscribe;
};

class InternalLens<S extends object, A> {
  static root<S extends object>() {
    return new InternalLens<S, S>(
      (state) => state,
      (_, value) => value
    );
  }

  constructor(public get: GetFn<S, A>, public set: SetFn<S, A>) {}

  refine<K extends keyof A>(key: K): InternalLens<S, A[K]> {
    return new InternalLens(
      (state) => {
        const current = this.get(state);
        return current[key];
      },
      (state, value) => {
        const current = this.get(state);
        let copy = current;

        if (Array.isArray(copy)) {
          copy = [...copy] as A;
        } else {
          copy = { ...copy } as A;
        }

        copy[key] = value;

        return this.set(state, copy);
      }
    );
  }
}

class RefLens<S extends object, A> implements Lens<A> {
  static fromValue<S extends object>(current: S): Lens<S> {
    const lens = InternalLens.root<S>();

    const rootParent: Parent = {
      notifyUp() {},
    };

    const rootRef: MutableRefObject<S> = {
      current,
    };

    return new RefLens(lens, rootParent, rootRef);
  }

  #subscribers: Set<Subscriber> = new Set();
  #children: { [K in keyof A]?: RefLens<S, A[K]> } = {};
  #lens: InternalLens<S, A>;
  #parent: Parent;
  #rootRef: MutableRefObject<S>;

  constructor(lens: InternalLens<S, A>, parent: Parent, rootRef: MutableRefObject<S>) {
    this.#lens = lens;
    this.#parent = parent;
    this.#rootRef = rootRef;
  }

  get current(): A {
    return this.#lens.get(this.#rootRef.current);
  }

  refine<K extends keyof A>(key: K): Lens<A[K]> {
    let refLens = this.#children[key];

    if (!refLens) {
      const lens = this.#lens.refine(key);
      const parent: Parent = { notifyUp: () => this.#notifyUp() };

      refLens = new RefLens(lens, parent, this.#rootRef);

      this.#children[key] = refLens;
    }

    return refLens;
  }

  refineDeep<K extends Paths<A> & string>(keyPath: K): Lens<GetDeep<A, K>> {
    let lens = this as Lens<any>;

    for (const key of keyPath.split(".")) {
      lens = lens.refine(key);
    }

    return lens as Lens<GetDeep<A, K>>;
  }

  update(fn: (prev: A) => A): void {
    let prev: A;

    /**
     * Wrap the getter in a try/catch because it may throw an error.
     */
    try {
      prev = this.current;
    } catch {
      return;
    }

    const next = fn(prev);

    if (Object.is(prev, next)) return;

    this.#set(next);
  }

  subscribe(fn: Subscriber): Unsubscribe {
    this.#subscribers.add(fn);
    return () => this.#subscribers.delete(fn);
  }

  #set(value: A) {
    const prevS = this.#rootRef.current;
    const nextS = this.#lens.set(prevS, value);

    this.#rootRef.current = nextS;

    this.#notifyDown(prevS, nextS);
    this.#parent.notifyUp();
  }

  #notifyDown(prev: S, next: S) {
    /**
     * Wrap this in a try/catch because the getter may throw an error.
     * This can happen in lists where a getter has been removed.
     */
    try {
      const prevA = this.#lens.get(prev);
      const nextA = this.#lens.get(next);

      /**
       * If the value has not changed, then we don't need to notify.
       */
      if (Object.is(prevA, nextA)) return;
    } catch {}

    for (const key in this.#children) {
      const child = this.#children[key];

      if (!child) continue;

      child.#notifyDown(prev, next);
    }

    this.#notifySelf();
  }

  #notifyUp() {
    this.#notifySelf();
    this.#parent.notifyUp();
  }

  #notifySelf() {
    this.#subscribers.forEach((fn) => fn());
  }
}

export const makeLens = <S extends object>(initial: S): Lens<S> => RefLens.fromValue(initial);
