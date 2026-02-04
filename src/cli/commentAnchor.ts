import type { ParagraphBlockNode } from "../model/types";
import { mapOffsetToIndex } from "../compiler/rangeMap";

export type CommentAnchor = {
  anchor: string;
  quotedText: string;
  startIndex: number;
  endIndex: number;
};

export function buildCommentAnchor(
  paragraph: ParagraphBlockNode,
  startOffset: number,
  endOffset: number
): CommentAnchor {
  const quotedText = paragraph.plainText.slice(startOffset, endOffset);
  if (!quotedText) {
    throw new Error("Comment selection is empty.");
  }
  const startIndex = mapOffsetToIndex(paragraph, startOffset);
  const endIndex = mapOffsetToIndex(paragraph, endOffset);
  const encoded = encodeURIComponent(quotedText);
  const anchor = paragraph.flags.isHeading
    ? `text=${encoded}`
    : `text=${encoded}&startIndex=${startIndex}&endIndex=${endIndex}`;
  return { anchor, quotedText, startIndex, endIndex };
}
