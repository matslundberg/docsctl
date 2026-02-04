export type BlockType =
  | "paragraph"
  | "table"
  | "horizontalRule"
  | "embed"
  | "sectionBreak"
  | "pageBreak";

export interface ApiRange {
  start: number;
  end: number;
}

export interface HeadingRef {
  nodeId: string;
  text: string;
  level: number;
}

export interface BlockFlags {
  isAtomic: boolean;
  containsInlineAtomic: boolean;
  isHeading: boolean;
  headingLevel?: number;
  isListItem: boolean;
  isCodePara: boolean;
}

export interface BlockNode {
  nodeId: string;
  type: BlockType;
  parentContainerId: string;
  apiRange: ApiRange;
  headingPath: HeadingRef[];
  flags: BlockFlags;
  raw: Record<string, unknown>;
}

export interface ParagraphStyle {
  namedStyleType?: string;
  alignment?: string;
  indentStart?: number;
  indentEnd?: number;
  lineSpacing?: number;
  shading?: string;
}

export interface TextStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  link?: string;
  fontFamily?: string;
  fontSize?: number;
}

export interface RangeMapSegment {
  textStart: number;
  textEnd: number;
  docStart: number;
  docEnd: number;
}

export interface RangeMap {
  segments: RangeMapSegment[];
  textLength: number;
}

export interface TextRunInlineNode {
  kind: "text";
  text: string;
  style: TextStyle;
  apiRange: ApiRange;
}

export interface InlineImageNode {
  kind: "inlineImage";
  altText?: string;
  size?: { width: number; height: number };
  apiRange: ApiRange;
}

export interface SmartChipNode {
  kind: "smartChip";
  chipType: string;
  displayText: string;
  apiRange: ApiRange;
}

export type InlineNode = TextRunInlineNode | InlineImageNode | SmartChipNode;

export interface ParagraphBlockNode extends BlockNode {
  type: "paragraph";
  plainText: string;
  runs: InlineNode[];
  paraStyle: ParagraphStyle;
  rangeMap: RangeMap;
}

export interface TableCellNode {
  row: number;
  col: number;
  blocks: BlockNode[];
}

export interface TableBlockNode extends BlockNode {
  type: "table";
  nRows: number;
  nCols: number;
  cells: TableCellNode[][];
}

export interface HorizontalRuleBlockNode extends BlockNode {
  type: "horizontalRule";
}

export interface EmbeddedObjectBlockNode extends BlockNode {
  type: "embed";
  objectKind: string;
}

export interface ContainerNode {
  containerId: string;
  children: BlockNode[];
  apiRange: ApiRange;
}

export interface ModelIndex {
  headingsInOrder: string[];
  headingTextToNodes: Map<string, string[]>;
  blocksUnderHeading: Map<string, string[]>;
  nodeById: Map<string, BlockNode>;
}

export interface DocumentModel {
  docId: string;
  revisionId: string;
  body: ContainerNode;
  blocks: BlockNode[];
  index: ModelIndex;
}

export type TargetKind = "block" | "blockRange" | "textRange";

export interface ResolvedTarget {
  kind: TargetKind;
  blocks?: BlockNode[];
  block?: BlockNode;
  textRange?: {
    paragraph: ParagraphBlockNode;
    startOffset: number;
    endOffset: number;
  };
  context: {
    headingPath: string[];
    snippet: string;
    conflicts: string[];
  };
}
