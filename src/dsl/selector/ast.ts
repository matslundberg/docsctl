import type { CallChainAst } from "../shared/parser";

export type SelectorAst = {
  type: "selector";
  callChain: CallChainAst;
};
