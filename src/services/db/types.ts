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

export interface Recording {
  id: number;
  filename: string;
  duration: number;
  timestamp: string;
  groupId: number | null;
  label: string | null;
}

export interface Transcript {
  id: number;
  recordingId: number;
  textContent: string;
  diarizedJson: string | null;
}

export interface Summary {
  id: number;
  transcriptId: number;
  summaryText: string;
}

export interface LibraryRecording {
  id: number;
  filename: string;
  duration: number;
  timestamp: string;
  label: string | null;
  hasTranscript: boolean;
  hasAudio?: boolean;
  tags?: string[];
}

export interface Tag {
  name: string;
  context: string;
}

export interface GlossaryTerm {
  term: string;
  meaning: string;
}
