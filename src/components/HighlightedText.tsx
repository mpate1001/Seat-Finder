interface HighlightedTextProps {
  text: string;
  ranges: ReadonlyArray<readonly [number, number]>;
}

export default function HighlightedText({ text, ranges }: HighlightedTextProps) {
  if (ranges.length === 0) {
    return <>{text}</>;
  }

  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: Array<string | JSX.Element> = [];
  let cursor = 0;

  for (const [rawStart, end] of sorted) {
    const start = Math.max(rawStart, cursor);
    if (start > end) continue;
    if (start > cursor) {
      out.push(text.slice(cursor, start));
    }
    out.push(<strong key={start}>{text.slice(start, end + 1)}</strong>);
    cursor = end + 1;
  }

  if (cursor < text.length) {
    out.push(text.slice(cursor));
  }

  return <>{out}</>;
}
