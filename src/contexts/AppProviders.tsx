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

import { ReactNode } from 'react';
import { LibrarySettingsProvider, useLibrarySettings } from './LibrarySettingsContext';
import { SessionProvider } from './SessionContext';
import { saveRecording } from '../services/db';

function SessionIntegration({ children }: { children: ReactNode }) {
  const { refreshLibrary, autoTranscribe, handleTranscription, loadRecordingIntoAnalysis, enableLogs, namingSchema, recordings } = useLibrarySettings();

  const handleRecordingStopped = async (savedPaths: string[], duration: number, label: string | null) => {
    const recIds: number[] = [];
    for (const savedPath of savedPaths) {
      const filename = savedPath.split(/[/\\]/).pop() || savedPath;
      const recId = await saveRecording(filename, duration, label);
      recIds.push(recId);
    }

    refreshLibrary();

    if (recIds.length > 0) {
      const lastRecId = recIds[recIds.length - 1];
      // Instead of setActiveRecordingId, we can use loadRecordingIntoAnalysis to set it properly
      await loadRecordingIntoAnalysis(lastRecId);
      
      if (autoTranscribe) {
        for (let i = 0; i < savedPaths.length; i++) {
          // In the original, handleTranscription is not exposed.
          // Wait! Let's check if we can expose handleTranscription in LibrarySettingsContext.
          if (typeof handleTranscription === 'function') {
            handleTranscription(savedPaths[i], recIds[i]).catch((err: any) => console.error("Auto-transcription error:", err));
          } else {
             console.warn("handleTranscription is not exposed by LibrarySettingsContext");
          }
        }
      }
    }
  };

  return (
    <SessionProvider 
      onRecordingStopped={handleRecordingStopped} 
      enableLogs={enableLogs}
      namingSchema={namingSchema}
      recordings={recordings}
    >
      {children}
    </SessionProvider>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  
  return (
    <LibrarySettingsProvider >
      <SessionIntegration>
        {children}
      </SessionIntegration>
    </LibrarySettingsProvider>
  );
}
