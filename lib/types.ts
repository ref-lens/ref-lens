import { Lens } from "./lens";

// prettier-ignore
export type GetDeep<T, K extends string> = 
  K extends keyof T ? T[K] :
  K extends `${number}` ? (T extends any[] ? T[number] : never) :
  K extends `${number}.${infer Rest}` ? (T extends any[] ? GetDeep<T[number], Rest> : never) :
  K extends `${infer First}.${infer Rest}` ? (First extends keyof T ? GetDeep<T[First], Rest> : never) :
  never;

export type ExtractLensType<L> = L extends Lens<infer A> ? A : never;
