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

import { useLibrarySettings } from '../contexts/LibrarySettingsContext';
import { useActiveSession } from '../contexts/SessionContext';

export function AudioRecorderPill() {
  const { isRecording, recordingSeconds, stopRecording } = useActiveSession();
  const { activeTab } = useLibrarySettings();

  if (!isRecording || activeTab === 'studio') {
    return null;
  }

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="audio-recorder-pill glass-panel">
      <div className="pill-status">
        <div className="recording-dot pulse"></div>
        <span className="recording-time">{formatTime(recordingSeconds)}</span>
      </div>
      <button className="pill-stop-btn" onClick={stopRecording} title="Stop Recording">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <rect x="6" y="6" width="12" height="12" rx="2" ry="2"></rect>
        </svg>
      </button>
    </div>
  );
}
