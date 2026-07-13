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
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownRenderer, parseInlineMarkdown } from './MarkdownRenderer';

describe('MarkdownRenderer', () => {
  it('parses inline markdown bold text', () => {
    const res = parseInlineMarkdown('Hello **world**!');
    expect(res).toHaveLength(3);
    expect(res[0]).toBe('Hello ');
    expect(res[2]).toBe('!');
  });

  it('renders headers, lists, paragraphs', () => {
    const md = `
# Header 1
## Header 2
### Header 3

- List Item
- **Bold** List Item

A simple paragraph.
    `;
    render(<MarkdownRenderer content={md} />);
    
    expect(screen.getByText('Header 1')).toBeInTheDocument();
    expect(screen.getByText('Header 2')).toBeInTheDocument();
    expect(screen.getByText('Header 3')).toBeInTheDocument();
    expect(screen.getAllByText('List Item').length).toBeGreaterThan(0);
    expect(screen.getByText('Bold')).toBeInTheDocument();
    expect(screen.queryByText('List Item', { selector: 'strong' })).toBeNull(); // Bold is only applied to 'Bold'
    expect(screen.getByText('A simple paragraph.')).toBeInTheDocument();
  });
  
  it('returns null on empty content', () => {
    const { container } = render(<MarkdownRenderer content="" />);
    expect(container).toBeEmptyDOMElement();
  });
});
