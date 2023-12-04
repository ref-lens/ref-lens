import { makeLens, type Lens as CoreLens } from "./lens";
import { filterArray, mapArray, type LensProxy as CoreProxy } from "./proxy";
import { useLens } from "./react";

export type Lens<A> = CoreLens<any, A>;
export type LensProxy<A> = CoreProxy<any, A>;

export { filterArray, makeLens, mapArray, useLens };
