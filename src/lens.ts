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

const shallowCopy = <T>(obj: T): T => {
  if (Array.isArray(obj)) {
    return [...obj] as T;
  } else {
    return { ...obj } as T;
  }
};

export class Lens<S extends object, A> implements MutableRefObject<A> {
  static fromValue<S extends object>(current: S): Lens<S, S> {
    return Lens.fromRef({ current });
  }

  static fromRef<S extends object>(rootRef: MutableRefObject<S>): Lens<S, S> {
    const rootParent: Parent<S> = {
      notifyUp() {},
      cachedGetter(root) {
        return root;
      },
    };

    return new Lens(
      (state) => state,
      (state, value) => value,
      rootParent,
      rootRef
    );
  }

  #cache: WeakMap<object, A> = new WeakMap();
  #subscribers: Set<Subscriber> = new Set();
  #children: { [K in keyof A]?: Lens<S, A[K]> } = {};
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
    return this.#cachedGetter(this.#rootRef.current);
  }

  set current(value: A) {
    const prev = this.#rootRef.current;
    const next = this.#setter(prev, value);

    this.#rootRef.current = next;
    this.#notifyDown(prev, next);
    this.#parent.notifyUp();
  }

  prop<K extends keyof A>(key: K): Lens<S, A[K]> {
    let lens = this.#children[key];

    if (!lens) {
      const parent: Parent<S> = {
        notifyUp: () => this.#notifyUp(),
        cachedGetter: (state) => this.#cachedGetter(state),
      };

      lens = new Lens(
        (state) => {
          const current = this.#cachedGetter(state);
          return current[key];
        },
        (state, value) => {
          const current = this.#cachedGetter(state);
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

  update(fn: (value: A) => A): void;
  update(fn: (value: A) => Promise<A>): Promise<void>;
  update(fn: (value: A) => A | Promise<A>): void | Promise<void> {
    let current: A;

    try {
      current = this.current;
    } catch {
      return;
    }

    const next = fn(current);

    if (next instanceof Promise) {
      return next.then((value) => {
        this.current = value;
        return;
      });
    } else {
      this.current = next;
    }
  }

  subscribe(fn: Subscriber): Unsubscribe {
    this.#subscribers.add(fn);

    return () => {
      this.#subscribers.delete(fn);
    };
  }

  #notifyDown(prev: S, next: S) {
    /**
     * Wrap this in a try/catch because the getter may throw an error.
     * This can happen in lists where a getter has been removed.
     */
    try {
      const prevA = this.#cachedGetter(prev);
      const nextA = this.#cachedGetter(next);

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

  #cachedGetter(root: S): A {
    /**
     * Get the parent state as a key for the cache.
     */
    const key = this.#parent.cachedGetter(root);
    let cached = this.#cache.get(key);

    if (!cached) {
      cached = this.#getter(root);
      this.#cache.set(key, cached);
    }

    return cached;
  }

  #notifySelf() {
    this.#subscribers.forEach((fn) => fn());
  }
}

export const makeLens = <S extends object>(initial: S): Lens<any, S> => Lens.fromValue(initial);
