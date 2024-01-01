import { Paths } from "type-fest";
import { ExtractLensType, GetDeep } from "./types";

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

type SafeResult<A> = { success: true; value: A } | { success: false };

export const Lens = {
  castUnion: <L extends Lens<any>>(lens: L): Lens<ExtractLensType<L>> => lens,
};

export type Lens<A> = {
  /**
   * Gets the current value of the lens.
   */
  get current(): A;

  /**
   * Safely gets the current value of the lens.
   */
  safeCurrent(): SafeResult<A>;
  /**
   * Refines the lens by a single property key.
   * @param key The property key.
   */
  prop<K extends keyof A>(key: K): Lens<A[K]>;
  /**
   * Deeply refines the lens by a property key path.
   * @param keyPath The property key path.
   */
  deepProp<K extends Paths<A> & string>(keyPath: K): Lens<GetDeep<A, K>>;
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

  refine<B>(get: GetFn<A, B>, set: SetFn<A, B>): InternalLens<S, B> {
    return new InternalLens(
      (state) => {
        const prev = this.get(state);
        return get(prev);
      },
      (state, value) => {
        const prev = this.get(state);
        const next = set(prev, value);

        return this.set(state, next);
      }
    );
  }

  prop<K extends keyof A>(key: K): InternalLens<S, A[K]> {
    return this.refine(
      (prev) => prev[key],
      (prev, value) => {
        let copy = prev;

        if (Array.isArray(copy)) {
          copy = [...copy] as A;
        } else {
          copy = { ...copy } as A;
        }

        copy[key] = value;

        return copy;
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
  #props: { [K in keyof A]?: RefLens<S, A[K]> } = {};
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

  safeCurrent(): SafeResult<A> {
    try {
      return { success: true, value: this.current };
    } catch {
      return { success: false };
    }
  }

  prop<K extends keyof A>(key: K): RefLens<S, A[K]> {
    let refLens = this.#props[key];

    if (!refLens) {
      const lens = this.#lens.prop(key);
      const parent: Parent = { notifyUp: () => this.#notifyUp() };

      refLens = new RefLens(lens, parent, this.#rootRef);

      this.#props[key] = refLens;
    }

    return refLens;
  }

  deepProp<K extends Paths<A> & string>(keyPath: K): RefLens<S, GetDeep<A, K>> {
    let lens = this as Lens<any>;

    for (const key of keyPath.split(".")) {
      lens = lens.prop(key);
    }

    return lens as RefLens<S, GetDeep<A, K>>;
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

  // cast<K extends keyof A>(key: K): void {}

  #set(value: A): void {
    const prevS = this.#rootRef.current;
    const nextS = this.#lens.set(prevS, value);

    this.#rootRef.current = nextS;

    this.#notifyDown(prevS, nextS);
    this.#parent.notifyUp();
  }

  #notifyDown(prev: S, next: S): void {
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

    for (const key in this.#props) {
      const child = this.#props[key];

      if (!child) continue;

      child.#notifyDown(prev, next);
    }

    this.#notifySelf();
  }

  #notifyUp(): void {
    this.#notifySelf();
    this.#parent.notifyUp();
  }

  #notifySelf(): void {
    this.#subscribers.forEach((fn) => fn());
  }
}

export const makeLens = <S extends object>(initial: S): Lens<S> => RefLens.fromValue(initial);
