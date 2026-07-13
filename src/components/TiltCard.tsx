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

import React, { useRef, useState, CSSProperties } from 'react';

interface TiltCardProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  href?: string;
  target?: string;
}

export const TiltCard: React.FC<TiltCardProps> = ({ children, className = '', style, href, target, ...props }) => {
  const cardRef = useRef<HTMLElement>(null);
  const [tiltStyle, setTiltStyle] = useState<CSSProperties>({});

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // 3D Tilt calculations matching ekarbe.github.io
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -4; // Max rotation 4deg
    const rotateY = ((x - centerX) / centerX) * 4;

    setTiltStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.01)`,
      transition: 'transform 0.1s ease-out'
    });
  };

  const handleMouseLeave = () => {
    setTiltStyle({
      transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)',
      transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
    });
  };

  const Component = href ? 'a' : 'div';

  return (
    <Component
      ref={cardRef as any}
      href={href}
      target={target}
      className={`bento-card ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ ...style, ...tiltStyle, display: 'block', textDecoration: 'none', color: 'inherit' }}
      {...(props as any)}
    >
      {children}
    </Component>
  );
};
