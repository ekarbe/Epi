import { useActiveSession } from '../contexts/SessionContext';
import { useLibrarySettings } from '../contexts/LibrarySettingsContext';
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

import { useEffect, useRef } from 'react';
import { getAutomations } from '../services/db/automations';
import { getLibraryRecordings, getTranscriptForRecording, getSummaryForTranscript } from '../services/db';
import { documentDir, join } from '../lib/api';
import { transcribeAudio } from '../services/whisper';
import { saveTranscript } from '../services/db';
import { summarizeTranscript } from '../services/ollama';
import { saveSummary } from '../services/db';
import { getBaseName } from '../utils/path';
import { BaseDirectory, writeTextFile } from '../lib/api';

export function AutomationRunner() {
  const __lib = useLibrarySettings();
  const __sess = useActiveSession();
  const context = { ...__lib, ...__sess } as any;
  const contextRef = useRef(context);
  const lastRunMinuteRef = useRef<string | null>(null);

  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  useEffect(() => {
    if (!context.dbReady) return;

    const runAutomations = async () => {
      try {
        const automations = await getAutomations();
        if (automations.length === 0) return;

        const now = new Date();
        const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        if (lastRunMinuteRef.current === currentHHMM) {
          return; // Already checked and ran rules for this exact minute
        }
        lastRunMinuteRef.current = currentHHMM;

        for (const rule of automations) {
          if (rule.triggerTime === currentHHMM) {
            console.log(`[Automation] Triggering rule: ${rule.name}`);
            const recordings = await getLibraryRecordings();
            
            // Filter recordings by timerange
            const cutoffTime = new Date(now.getTime() - (rule.timerangeHours * 60 * 60 * 1000));
            const targetRecordings = recordings.filter(r => {
              const rTime = new Date(r.timestamp.replace(' ', 'T') + 'Z');
              return rTime >= cutoffTime;
            });

            const ctx = contextRef.current;

            for (const rec of targetRecordings) {
              if (rule.action === 'transcribe' || rule.action === 'summarize') {
                if (!rec.hasTranscript) {
                  // Headless transcription
                  try {
                    const docsDir = await documentDir();
                    const filePath = await join(docsDir, 'Epi Library', 'Recordings', rec.filename);
                    
                    let activeModel = ctx.whisperXModel;
                    if (ctx.transcriptionProvider === 'openai') activeModel = ctx.openaiTranscriptionModel;
                    else if (ctx.transcriptionProvider === 'assembly') activeModel = ctx.assemblyTranscriptionModel;
                    else if (ctx.transcriptionProvider === 'google') activeModel = ctx.googleTranscriptionModel;

                    ctx.addTranscribingId(rec.id);
                    const result = await transcribeAudio(
                      filePath, 
                      activeModel, 
                      ctx.whisperXLanguage, 
                      ctx.whisperXPrompt, 
                      parseFloat(ctx.whisperXTemperature) || 0.0,
                      ctx.transcriptionProvider,
                      ctx.apiKeys[ctx.transcriptionProvider] || '',
                      {
                        device: ctx.whisperXDevice as 'cpu' | 'cuda',
                        computeType: ctx.whisperXComputeType as 'int8' | 'float16' | 'float32',
                        batchSize: ctx.whisperXBatchSize,
                        diarize: ctx.whisperXDiarize,
                        hfToken: ctx.whisperXHfToken,
                        minSpeakers: Math.min(ctx.whisperXMinSpeakers, ctx.whisperXMaxSpeakers),
                        maxSpeakers: Math.max(ctx.whisperXMinSpeakers, ctx.whisperXMaxSpeakers),
                        noAlign: false
                      }
                    );
                    
                    await saveTranscript(rec.id, result);
                    const baseName = getBaseName(rec.filename);
                    await writeTextFile(`Epi Library/Transcriptions/${baseName}_transcript.txt`, result, { baseDir: BaseDirectory.Document });
                    ctx.removeTranscribingId(rec.id);
                    ctx.refreshLibrary(); // Progressive UI update
                  } catch (err) {
                    console.error(`[Automation] Transcription failed for ${rec.filename}:`, err);
                    ctx.removeTranscribingId(rec.id);
                    ctx.refreshLibrary();
                    continue; // Skip summary if transcription failed
                  }
                }
              }

              if (rule.action === 'summarize') {
                try {
                  const t = await getTranscriptForRecording(rec.id);
                  if (t) {
                    const existingSummary = await getSummaryForTranscript(t.id);
                    if (existingSummary) {
                      continue; // Skip if already summarized
                    }

                    let activeModel = ctx.ollamaModel;
                    if (ctx.llmProvider === 'openai') activeModel = ctx.openaiLlmModel;
                    else if (ctx.llmProvider === 'anthropic') activeModel = ctx.anthropicLlmModel;
                    else if (ctx.llmProvider === 'google') activeModel = ctx.googleLlmModel;

                    ctx.addSummarizingRecId(rec.id);
                    const sum = await summarizeTranscript(
                      t.textContent, 
                      "Please provide an executive summary and action items for:\n\n{{transcript}}", 
                      ctx.ollamaUrl, 
                      activeModel, 
                      ctx.llmProvider, 
                      ctx.apiKeys[ctx.llmProvider] || '', 
                      {
                        temperature: ctx.ollamaTemperature,
                        num_ctx: ctx.ollamaNumCtx,
                        top_p: ctx.ollamaTopP,
                        top_k: ctx.ollamaTopK,
                        system: ctx.ollamaSystemPrompt
                      }
                    );
                    
                    await saveSummary(t.id, sum);
                    const baseName = getBaseName(rec.filename);
                    await writeTextFile(`Epi Library/Summaries/${baseName}_summary.md`, sum, { baseDir: BaseDirectory.Document });
                    ctx.removeSummarizingRecId(rec.id);
                    ctx.refreshLibrary();
                  }
                } catch (err) {
                  console.error(`[Automation] Summary failed for ${rec.filename}:`, err);
                  ctx.removeSummarizingRecId(rec.id);
                  ctx.refreshLibrary();
                }
              }
            }
            
            // Refresh library at the end so UI updates
            ctx.refreshLibrary();
          }
        }
      } catch (err) {
        console.error('[Automation] Error running automations:', err);
      }
    };

    // Check once immediately, then every 30 seconds to avoid missing the minute rollover
    runAutomations();
    const interval = setInterval(runAutomations, 30000);
    return () => clearInterval(interval);
  }, [context.dbReady]);

  return null;
}
