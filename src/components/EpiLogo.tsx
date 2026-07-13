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

export function EpiLogo({ className, style }: { className?: string, style?: React.CSSProperties }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-24 -16 140 140" width="100%" height="100%" className={className} style={style}>
      <defs>
        <linearGradient id="bg-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#d6d6db" />
        </linearGradient>
      </defs>
      <rect x="-24" y="-16" width="140" height="140" rx="32" fill="url(#bg-grad)" />
      <rect x="46.5" y="74" width="7" height="20" fill="#1D1D1F" />
      <rect x="39" y="23" width="22" height="38" rx="11" fill="#1D1D1F" />
      <path d="M4 44 H20 A6 6 0 0 1 26 50 A24 24 0 0 0 74 50 A6 6 0 0 1 80 44 H88.73 A40 40 0 1 0 50 94 A40 40 0 0 0 84.64 74" fill="none" stroke="#1D1D1F" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
