# Epi - Local-first Meeting Intelligence
# Copyright (C) 2026  Eike Christian Karbe
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
#

"""Live Transcription Service for Epi.

This script reads raw 16kHz mono 16-bit PCM audio from stdin, processes it into chunks,
and transcribes it in real-time using WhisperX / faster-whisper.
It outputs transcribed text to stdout with a "[TEXT]" prefix, which the Tauri Rust backend parses.

Dependencies:
- numpy
- torch
- whisperx
"""

import sys
import argparse
import gc
import re

try:
    import numpy as np
except ImportError as e:
    print(
        f"Error importing core dependencies: {e}. Please ensure numpy is installed.",
        file=sys.stderr,
    )
    sys.exit(1)

try:
    import torch
    from whisperx.asr import load_model
except ImportError as e:
    print(
        f"Error importing ML dependencies: {e}. Please ensure torch and whisperx are installed.",
        file=sys.stderr,
    )
    sys.exit(1)


def remove_overlap(prev_text: str, curr_text: str) -> str:
    """Removes overlapping word sequence between previous and current transcripts.

    Args:
        prev_text: Transcript of the preceding audio segment.
        curr_text: Transcript of the current audio segment.

    Returns:
        The deduplicated current transcript segment.
    """
    if not prev_text or not curr_text:
        return curr_text

    prev_words = prev_text.split()
    curr_words = curr_text.split()

    if not prev_words or not curr_words:
        return curr_text

    max_overlap = min(len(prev_words), len(curr_words))
    for i in range(max_overlap, 0, -1):
        if prev_words[-i:] == curr_words[:i]:
            return " ".join(curr_words[i:])

    return curr_text


def format_text(text: str) -> str:
    """Cleans up raw Whisper output for presentation.

    Args:
        text: Raw transcribed string.

    Returns:
        Cleaned string with trimmed whitespace.
    """
    return text.strip()


def main() -> None:
    """Main entry point. Parses CLI arguments, reads from stdin, and runs inference."""
    parser = argparse.ArgumentParser(description="Live transcribe with WhisperX / faster-whisper")
    parser.add_argument("--model", type=str, default="base", help="Model size")
    parser.add_argument("--language", type=str, default="en", help="Language code")
    parser.add_argument("--device-type", type=str, default=None, choices=["cpu", "cuda"], help="Inference device backend (cpu or cuda)")
    parser.add_argument("--compute-type", type=str, default=None, help="CTranslate2 compute quantization type (e.g. float16, int8)")
    parser.add_argument("--window-size", type=float, default=3.0, help="Audio chunk size window in seconds for inference")
    parser.add_argument("--overlap-size", type=float, default=1.0, help="Overlap overlap size in seconds")
    args = parser.parse_args()

    if args.overlap_size >= args.window_size:
        parser.error("--overlap-size must be less than --window-size")

    # Auto-detect hardware accelerator backends and model quantization
    if args.device_type is not None:
        device_type = args.device_type
    else:
        device_type = "cuda" if torch.cuda.is_available() else "cpu"

    if args.compute_type is not None:
        compute_type = args.compute_type
    else:
        compute_type = "float16" if device_type == "cuda" else "int8"

    # Verify CUDA device safety
    if device_type == "cuda":
        try:
            torch.cuda.init()
        except Exception as e:
            print(f"CUDA initialization failed: {e}. Falling back to CPU.", file=sys.stderr)
            device_type = "cpu"
            compute_type = "int8"

    print(f"Loading model '{args.model}' on {device_type} ({compute_type})...", file=sys.stderr)
    try:
        asr = load_model(
            args.model,
            device_type,
            compute_type=compute_type,
            language=args.language if args.language != "auto" else None
        )
        model = asr.model
    except Exception as e:
        print(f"Error loading model: {e}", file=sys.stderr)
        sys.exit(1)

    print("Model loaded. Listening on stdin...", file=sys.stderr)

    samplerate = 16000
    
    try:
        audio_buffer = np.array([], dtype=np.float32)
        prev_text = ""
        loop_count = 0
        
        # 16kHz mono 16-bit PCM = 32000 bytes/sec
        # We read ~0.25 seconds per iteration
        chunk_bytes = 8000
        
        while True:
            raw_bytes = sys.stdin.buffer.read(chunk_bytes)
            if not raw_bytes:
                break
                
            chunk_int16 = np.frombuffer(raw_bytes, dtype=np.int16)
            new_audio = chunk_int16.astype(np.float32) / 32768.0
            
            audio_buffer = np.concatenate((audio_buffer, new_audio))
            
            if len(audio_buffer) >= int(args.window_size * samplerate):
                process_audio = audio_buffer.copy()
                
                # Keep overlap_size seconds of audio for the next chunk to maintain context
                keep_samples = int(args.overlap_size * samplerate)
                audio_buffer = audio_buffer[-keep_samples:] if len(audio_buffer) > keep_samples else np.array([], dtype=np.float32)
                
                try:
                    segments, _ = model.transcribe(process_audio)
                    if not segments:
                        continue
                        
                    curr_text = " ".join([seg.text for seg in segments]).strip()
                    
                    if curr_text:
                        # Periodic forced garbage collection
                        loop_count += 1
                        if loop_count % 10 == 0:
                            gc.collect()
                            if device_type == "cuda":
                                torch.cuda.empty_cache()

                        # Avoid repeating overlapping text
                        new_text = remove_overlap(prev_text, curr_text)
                        
                        if new_text.strip():
                            formatted = format_text(new_text)
                            print(f"[TEXT]{formatted}", flush=True)
                            
                        prev_text = curr_text
                        
                except Exception as e:
                    print(f"Inference error: {e}", file=sys.stderr)
                    
    except KeyboardInterrupt:
        print("Interrupted by user.", file=sys.stderr)
    except Exception as e:
        print(f"Unexpected error in capture loop: {e}", file=sys.stderr)
    finally:
        print("Transcription stopped.", file=sys.stderr)

if __name__ == "__main__":
    main()
