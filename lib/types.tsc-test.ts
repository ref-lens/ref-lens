import { GetDeep } from "./types";

{
  // GetDeep should work with a single key

  type Input = { foo: { bar: { baz: [{ qux: string }] } } };

  type Output = GetDeep<Input, "foo">;

  type Expected = { bar: { baz: [{ qux: string }] } };

  let expected!: Expected;
  let output: Output = expected;
}

{
  // GetDeep should work with nested keys

  type Input = { foo: { bar: { baz: [{ qux: string }] } } };

  type Output = GetDeep<Input, "foo.bar.baz">;

  type Expected = [{ qux: string }];

  let expected!: Expected;
  let output: Output = expected;
}

{
  // GetDeep should work with array indices

  type Input = { foo: { bar: { baz: [{ qux: string }] } } };

  type Output = GetDeep<Input, "foo.bar.baz.0.qux">;

  type Expected = string;

  let expected!: Expected;
  let output: Output = expected;
}
