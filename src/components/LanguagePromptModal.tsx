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

import { useState } from "react";
import { useLibrarySettings } from "../contexts/LibrarySettingsContext";

export function LanguagePromptModal() {
  const { pendingLanguagePrompt, handleRetryTranscription, handleCancelLanguagePrompt } = useLibrarySettings();
  const [selectedLang, setSelectedLang] = useState("en");
  const [customLang, setCustomLang] = useState("");
  const [noAlign, setNoAlign] = useState(false);

  // If there's no prompt, we don't render anything
  if (!pendingLanguagePrompt) return null;

  const handleConfirm = () => {
    const finalLang = selectedLang === "other" ? customLang.trim() : selectedLang;
    if (selectedLang === "other" && !finalLang) {
      alert("Please enter a custom language code.");
      return;
    }
    handleRetryTranscription(pendingLanguagePrompt.recordingId, pendingLanguagePrompt.filePath, finalLang || "en", noAlign);
  };

  const filename = pendingLanguagePrompt.filePath.split(/[/\\]/).pop() || pendingLanguagePrompt.filePath;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          WhisperX Alignment Missing
        </div>
        <div className="modal-body">
          <div style={{
            background: 'var(--card-bg-solid)',
            border: '1px solid var(--card-border)',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            fontSize: '0.85rem',
            color: 'var(--text-primary)',
            fontWeight: 500
          }}>
            File: <span style={{ color: 'var(--accent-blue)', fontFamily: 'monospace' }}>{filename}</span>
          </div>

          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            WhisperX auto-detected the audio language as <strong>{pendingLanguagePrompt.detectedLanguage}</strong>, but there is no default alignment model for this language.
          </p>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            If the audio is in a different language (e.g. English), select it below to retry:
          </p>
          
          <div className="form-group" style={{ width: '100%', marginBottom: '1rem' }}>
            <label className="form-label">Audio Language</label>
            <select 
              className="config-input" 
              value={selectedLang} 
              onChange={(e) => setSelectedLang(e.target.value)}
            >
              <option value="en">English (en)</option>
              <option value="de">German (de)</option>
              <option value="fr">French (fr)</option>
              <option value="es">Spanish (es)</option>
              <option value="it">Italian (it)</option>
              <option value="pt">Portuguese (pt)</option>
              <option value="ja">Japanese (ja)</option>
              <option value="zh">Chinese (zh)</option>
              <option value="other">Other (Specify code)</option>
            </select>
          </div>

          {selectedLang === "other" && (
            <div className="form-group" style={{ width: '100%', marginBottom: '1rem' }}>
              <label className="form-label">Custom ISO 639-1 Language Code</label>
              <input 
                type="text" 
                className="config-input" 
                placeholder="e.g. cy, nl, uk" 
                value={customLang}
                onChange={(e) => setCustomLang(e.target.value)}
              />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginTop: '0.25rem', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              id="no-align-checkbox"
              checked={noAlign} 
              onChange={(e) => setNoAlign(e.target.checked)} 
              style={{ width: '1.2rem', height: '1.2rem', margin: 0, cursor: 'pointer' }}
            />
            <label htmlFor="no-align-checkbox" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none', lineHeight: '1.2' }}>
              Bypass phoneme alignment (runs faster, but no word-level timestamps)
            </label>
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handleCancelLanguagePrompt}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleConfirm}>
            Retry Transcription
          </button>
        </div>
      </div>
    </div>
  );
}
