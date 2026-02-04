import type { SelectorAst } from "./ast";
import { formatCallChain } from "../shared/parser";

export function normalizeSelector(ast: SelectorAst): string {
  return formatCallChain(ast.callChain);
}
