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

import { DashboardGrid } from "./components/DashboardGrid";
import { StudioTab } from "./components/Tabs/StudioTab";
import { AnalysisTab } from "./components/Tabs/AnalysisTab";
import { EngineTab } from "./components/Tabs/EngineTab";
import { LibraryTab } from "./components/Tabs/LibraryTab";
import { useLibrarySettings } from "./contexts/LibrarySettingsContext";
import { Navbar } from "./components/Navbar";
import { LanguagePromptModal } from "./components/LanguagePromptModal";
import { AutomationRunner } from "./components/AutomationRunner";
import { AudioRecorderPill } from "./components/AudioRecorderPill";

export function MainApp() {
  const { 
    activeTab, 
    dbReady, 
    dbError 
  } = useLibrarySettings();

  return (
    <div className="app-container">
      <Navbar />

      <DashboardGrid>
        {dbError && (
          <div className="alert-message alert-danger">
            <strong>Database Error:</strong> {dbError}
          </div>
        )}
        
        {!dbReady && !dbError && (
          <div className="loading-state">
            Initializing Database...
          </div>
        )}

        {dbReady && !dbError && activeTab === 'studio' && <StudioTab />}
        {dbReady && !dbError && activeTab === 'analysis' && <AnalysisTab />}
        {dbReady && !dbError && activeTab === 'library' && <LibraryTab />}
        {dbReady && !dbError && activeTab === 'engine' && <EngineTab />}
      </DashboardGrid>

      <LanguagePromptModal />
      <AutomationRunner />
      <AudioRecorderPill />
    </div>
  );
}
