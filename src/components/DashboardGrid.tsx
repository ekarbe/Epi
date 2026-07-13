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

import { ReactNode } from 'react';

interface DashboardGridProps {
  children: ReactNode;
}

/**
 * Bento layout grid container that aligns multiple BentoCards.
 */
export function DashboardGrid({ children }: DashboardGridProps) {
  return (
    <div className="bento-grid">
      {children}
    </div>
  );
}

interface BentoCardProps {
  children: ReactNode;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Individual layout card component styled with glassmorphism.
 */
export function BentoCard({ children, title, className = '', style }: BentoCardProps) {
  return (
    <div className={`bento-card ${className}`} style={style}>
      {title && <h3 style={{ marginBottom: '1.5rem', opacity: 0.9 }}>{title}</h3>}
      {children}
    </div>
  );
}
