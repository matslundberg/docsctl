type Range = { startIndex: number; endIndex: number };

function buildFields(style: Record<string, unknown>): string {
  return Object.keys(style)
    .filter((key) => style[key] !== undefined)
    .join(",");
}

export function insertTextRequest(index: number, text: string) {
  return {
    insertText: {
      location: { index },
      text,
    },
  };
}

export function deleteRangeRequest(start: number, end: number) {
  const range: Range = { startIndex: start, endIndex: end };
  return { deleteContentRange: { range } };
}

export function updateTextStyleRequest(start: number, end: number, style: Record<string, unknown>) {
  const range: Range = { startIndex: start, endIndex: end };
  return {
    updateTextStyle: {
      range,
      textStyle: style,
      fields: buildFields(style),
    },
  };
}

export function updateParagraphStyleRequest(start: number, end: number, style: Record<string, unknown>) {
  const range: Range = { startIndex: start, endIndex: end };
  return {
    updateParagraphStyle: {
      range,
      paragraphStyle: style,
      fields: buildFields(style),
    },
  };
}

export function insertInlineImageRequest(index: number, uri: string, altText?: string) {
  return {
    insertInlineImage: {
      location: { index },
      uri,
      ...(altText ? { altTextTitle: altText, altTextDescription: altText } : {}),
    },
  };
}

export function insertTableRequest(index: number, rows: number, columns: number) {
  return {
    insertTable: {
      rows,
      columns,
      location: { index },
    },
  };
}

export function insertHorizontalRuleRequest(index: number) {
  return {
    insertHorizontalRule: {
      location: { index },
    },
  };
}

export function createParagraphBulletsRequest(
  start: number,
  end: number,
  preset = "BULLET_DISC_CIRCLE_SQUARE"
) {
  const range: Range = { startIndex: start, endIndex: end };
  return {
    createParagraphBullets: {
      range,
      bulletPreset: preset,
    },
  };
}
