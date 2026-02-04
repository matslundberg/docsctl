import type { ParagraphBlockNode } from "../model/types";

export function mapOffsetToIndex(paragraph: ParagraphBlockNode, offset: number): number {
  const { segments, textLength } = paragraph.rangeMap;
  if (offset < 0 || offset > textLength) {
    throw new Error(`Offset ${offset} out of bounds (0..${textLength}).`);
  }
  if (segments.length === 0) {
    return paragraph.apiRange.start;
  }

  for (const segment of segments) {
    if (offset < segment.textStart) {
      continue;
    }
    if (offset > segment.textEnd) {
      continue;
    }
    if (offset === segment.textEnd) {
      return segment.docEnd;
    }
    return segment.docStart + (offset - segment.textStart);
  }

  return segments[segments.length - 1].docEnd;
}

export function paragraphEndIndex(paragraph: ParagraphBlockNode): number {
  if (paragraph.rangeMap.segments.length === 0) {
    return paragraph.apiRange.end;
  }
  const lastSegment = paragraph.rangeMap.segments[paragraph.rangeMap.segments.length - 1];
  return Math.max(paragraph.apiRange.end, lastSegment.docEnd);
}
