import type { SelectorAst } from "./ast";
import { parseCallChain } from "../shared/parser";

export function parseSelector(input: string): SelectorAst {
  return { type: "selector", callChain: parseCallChain(input) };
}
