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

import { Mic, FileText, Settings, Library, Sun, Moon } from "lucide-react";
import { useLibrarySettings } from "../contexts/LibrarySettingsContext";
import { EpiLogo } from "./EpiLogo";

export function Navbar() {
  const { activeTab, setActiveTab, isDark, setIsDark } = useLibrarySettings();

  return (
    <>
      <div className="sticky-pill-container">
        <div className="tab-container">
          <button 
            className={`tab-btn ${activeTab === 'studio' ? 'active' : ''}`}
            onClick={() => setActiveTab('studio')}
          >
            <Mic size={16} />
            Studio
          </button>
          <button 
            className={`tab-btn ${activeTab === 'analysis' ? 'active' : ''}`}
            onClick={() => setActiveTab('analysis')}
          >
            <FileText size={16} />
            Analysis
          </button>
          <button 
            className={`tab-btn ${activeTab === 'library' ? 'active' : ''}`}
            onClick={() => setActiveTab('library')}
          >
            <Library size={16} />
            Library
          </button>
          <button 
            className={`tab-btn ${activeTab === 'engine' ? 'active' : ''}`}
            onClick={() => setActiveTab('engine')}
          >
            <Settings size={16} />
            Engine
          </button>
        </div>
      </div>

      <nav className="navbar">
        <div className="logo-container">
          <EpiLogo className="logo-icon" style={{ padding: 0 }} />
          Epi
        </div>

        <button 
          className="theme-toggle" 
          onClick={() => setIsDark(!isDark)}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun size={20} color="var(--accent-amber)" /> : <Moon size={20} />}
        </button>
      </nav>
    </>
  );
}
