type Subscriber = () => void;
type Unsubscribe = () => void;

type GetFn<S, A> = (state: S) => A;
type SetFn<S, A> = (state: S, value: A) => S;

type MutableRefObject<S> = {
  current: S;
};

type Parent<S extends object> = {
  notifyUp(): void;
  cachedGetter(state: S): any;
};

export type Lens<A> = {
  get current(): A;
  prop<K extends keyof A>(key: K): Lens<A[K]>;
  set(fn: (value: A) => A): void;
  set(fn: (value: A) => Promise<A>): Promise<void>;
  subscribe(fn: Subscriber): Unsubscribe;
};

const GetterThrew = Symbol();

const shallowCopy = <T>(obj: T): T => {
  if (Array.isArray(obj)) {
    return [...obj] as T;
  } else {
    return { ...obj } as T;
  }
};

export class RefLens<S extends object, A> implements Lens<A> {
  static fromValue<S extends object>(current: S): Lens<S> {
    return RefLens.fromRef({ current });
  }

  static fromRef<S extends object>(rootRef: MutableRefObject<S>): Lens<S> {
    const rootParent: Parent<S> = {
      notifyUp() {},
      cachedGetter(root) {
        return root;
      },
    };

    return new RefLens(
      (state) => state,
      (state, value) => value,
      rootParent,
      rootRef
    );
  }

  #subscribers: Set<Subscriber> = new Set();
  #children: { [K in keyof A]?: RefLens<S, A[K]> } = {};
  #getter: GetFn<S, A>;
  #setter: SetFn<S, A>;
  #parent: Parent<S>;
  #rootRef: MutableRefObject<S>;

  constructor(getter: GetFn<S, A>, setter: SetFn<S, A>, parent: Parent<S>, rootRef: MutableRefObject<S>) {
    this.#getter = getter;
    this.#setter = setter;
    this.#parent = parent;
    this.#rootRef = rootRef;
  }

  get current(): A {
    return this.#getter(this.#rootRef.current);
  }

  prop<K extends keyof A>(key: K): Lens<A[K]> {
    let lens = this.#children[key];

    if (!lens) {
      const parent: Parent<S> = {
        notifyUp: () => this.#notifyUp(),
        cachedGetter: (state) => this.#getter(state),
      };

      lens = new RefLens(
        (state) => {
          const current = this.#getter(state);
          return current[key];
        },
        (state, value) => {
          const current = this.#getter(state);
          const copy = shallowCopy(current);

          copy[key] = value;

          return this.#setter(state, copy);
        },
        parent,
        this.#rootRef
      );

      this.#children[key] = lens;
    }

    return lens;
  }

  set(fn: (prev: A) => A): void;
  set(fn: (prev: A) => Promise<A>): Promise<void>;
  set(fn: (prev: A) => A | Promise<A>): void | Promise<void> {
    let prev: A | typeof GetterThrew;

    /**
     * Wrap the getter in a try/catch because it may throw an error.
     */
    try {
      prev = this.current;
    } catch {
      prev = GetterThrew;
    }

    if (prev === GetterThrew) {
      return;
    }

    const next = fn(prev);

    if (next instanceof Promise) {
      return next.then((value) => {
        this.#set(value);
      });
    } else {
      this.#set(next);
    }
  }

  subscribe(fn: Subscriber): Unsubscribe {
    this.#subscribers.add(fn);

    return () => {
      this.#subscribers.delete(fn);
    };
  }

  #set(value: A) {
    const prev = this.#rootRef.current;
    const next = this.#setter(prev, value);

    this.#rootRef.current = next;
    this.#notifyDown(prev, next);
    this.#parent.notifyUp();
  }

  #notifyDown(prev: S, next: S) {
    /**
     * Wrap this in a try/catch because the getter may throw an error.
     * This can happen in lists where a getter has been removed.
     */
    try {
      const prevA = this.#getter(prev);
      const nextA = this.#getter(next);

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
    this.#parent?.notifyUp();
  }

  #notifySelf() {
    this.#subscribers.forEach((fn) => fn());
  }
}

export const makeLens = <S extends object>(initial: S): Lens<S> => RefLens.fromValue(initial);
