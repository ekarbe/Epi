// Epi - Local-first Meeting Intelligence
// Copyright (C) 2026  Eike Christian Karbe
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
//

import { useMemo, ReactNode } from 'react';

/**
 * Parses inline markdown components like bold (**bold text**).
 * 
 * @param text - The plain text containing inline markdown markers.
 * @returns An array of JSX elements or strings.
 */
export function parseInlineMarkdown(text: string): ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

interface MarkdownRendererProps {
  content: string;
}

/**
 * MarkdownRenderer Component
 * Renders basic markdown elements (headers, lists, bold text, paragraphs) into native JSX elements.
 */
export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const rendered = useMemo(() => {
    if (!content) return null;
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      // Headers (e.g. ### Header)
      const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const text = parseInlineMarkdown(headerMatch[2]);
        if (level === 1) return <h1 key={idx} style={{ marginTop: '1.5rem', marginBottom: '0.75rem', fontWeight: 600 }}>{text}</h1>;
        if (level === 2) return <h2 key={idx} style={{ marginTop: '1.25rem', marginBottom: '0.5rem', fontWeight: 600 }}>{text}</h2>;
        return <h3 key={idx} style={{ marginTop: '1rem', marginBottom: '0.5rem', fontWeight: 600 }}>{text}</h3>;
      }

      // Bullet lists (e.g. - list item)
      if (line.trim().startsWith('- ')) {
        return (
          <ul key={idx} style={{ margin: '0.25rem 0 0.25rem 1.5rem', listStyleType: 'disc' }}>
            <li>{parseInlineMarkdown(line.trim().slice(2))}</li>
          </ul>
        );
      }

      // Paragraphs
      if (line.trim() === '') return <div key={idx} style={{ height: '0.5rem' }} />;
      return <p key={idx} style={{ margin: '0.5rem 0', lineHeight: 1.6 }}>{parseInlineMarkdown(line)}</p>;
    });
  }, [content]);

  return <>{rendered}</>;
}
