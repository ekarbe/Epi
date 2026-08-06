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



#[derive(serde::Serialize)]
pub struct WavMetadata {
    pub duration: u32,
    pub modified: String,
}

/// Retrieves metadata (duration and modification time) for an audio file (OGG, WAV, etc).
/// Uses Symphonia to parse the duration.
#[tauri::command]
pub async fn get_wav_metadata(path: String) -> Result<WavMetadata, String> {
    let resolved_path = crate::utils::validate_path_in_library(&path)?;
    tokio::task::spawn_blocking(move || {
        let file = std::fs::File::open(&resolved_path).map_err(|e| e.to_string())?;
        let metadata = file.metadata().map_err(|e| e.to_string())?;
        
        let modified_time = metadata.modified().unwrap_or(std::time::SystemTime::now());
        let chrono_time: chrono::DateTime<chrono::Utc> = modified_time.into();
        // SQLite uses Local or UTC in YYYY-MM-DD HH:MM:SS format
        let modified_str = chrono_time.format("%Y-%m-%d %H:%M:%S").to_string();

        let mut duration = 0;
        
        // Use symphonia to precisely calculate the duration
        let file_box = Box::new(file);
        let mss = symphonia::core::io::MediaSourceStream::new(file_box, Default::default());
        let mut hint = symphonia::core::probe::Hint::new();
        if let Some(ext) = std::path::Path::new(&resolved_path).extension().and_then(|e| e.to_str()) {
            hint.with_extension(ext);
        }
        
        let format_opts: symphonia::core::formats::FormatOptions = Default::default();
        let metadata_opts: symphonia::core::meta::MetadataOptions = Default::default();
        
        if let Ok(probed) = symphonia::default::get_probe().format(&hint, mss, &format_opts, &metadata_opts) {
            let format = probed.format;
            if let Some(track) = format.default_track() {
                if let (Some(n_frames), Some(sample_rate)) = (track.codec_params.n_frames, track.codec_params.sample_rate) {
                    if sample_rate > 0 {
                        duration = (n_frames / sample_rate as u64) as u32;
                    }
                }
            }
        }

        Ok(WavMetadata {
            duration,
            modified: modified_str,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;


    #[tokio::test]
    async fn test_get_wav_metadata_invalid_path() {
        let res = get_wav_metadata("/invalid/path/out/of/sandbox".to_string()).await;
        assert!(res.is_err());
    }

    #[tokio::test]
    async fn test_get_wav_metadata_empty_file() {
        let docs_dir = dirs::document_dir().unwrap_or_else(|| std::env::temp_dir());
        let library_dir = docs_dir.join("Epi Library");
        std::fs::create_dir_all(&library_dir).unwrap();
        
        use tempfile::Builder;
        let temp_file = Builder::new().tempfile_in(&library_dir).unwrap();
        let path = temp_file.path().to_string_lossy().to_string();
        
        let res = get_wav_metadata(path).await;
        assert!(res.is_ok());
        assert_eq!(res.unwrap().duration, 0);
    }
}
