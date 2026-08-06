import { LibraryRecording } from '../services/db/types';

/**
 * Generates a title for a new recording based on the user-defined schema.
 * 
 * Available variables:
 * {DD} - Day (01-31)
 * {MM} - Month (01-12)
 * {YYYY} - Year (e.g. 2026)
 * {HH} - Hour (00-23)
 * {mm} - Minute (00-59)
 * {counter} - Daily counter
 */
export function generateRecordingTitle(schema: string, existingRecordings: LibraryRecording[], title: string = "Recording"): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm_month = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm_time = String(now.getMinutes()).padStart(2, '0');

  // Calculate daily counter
  // Filter existingRecordings to find how many recordings were created on the current local date.
  // We compare the YYYY-MM-DD local format.
  const todayStr = `${yyyy}-${mm_month}-${dd}`;
  const todayRecordings = existingRecordings.filter(rec => {
    if (!rec.timestamp) return false;
    
    let dateObj;
    // Try to parse standard ISO or SQLite format
    if (rec.timestamp.includes('Z')) {
       dateObj = new Date(rec.timestamp);
    } else {
       // SQLite datetime format is usually UTC: "YYYY-MM-DD HH:MM:SS"
       // We can just append Z if it doesn't have it to treat it as UTC, which is standard.
       dateObj = new Date(rec.timestamp.replace(' ', 'T') + 'Z');
    }
    
    // Check if invalid date
    if (isNaN(dateObj.getTime())) {
      dateObj = new Date(rec.timestamp);
    }
    if (isNaN(dateObj.getTime())) return false;

    const recY = dateObj.getFullYear();
    const recM = String(dateObj.getMonth() + 1).padStart(2, '0');
    const recD = String(dateObj.getDate()).padStart(2, '0');
    return `${recY}-${recM}-${recD}` === todayStr;
  });

  const counter = todayRecordings.length + 1;

  let result = schema;
  result = result.replace(/{title}/g, title);
  result = result.replace(/{DD}/g, dd);
  result = result.replace(/{MM}/g, mm_month);
  result = result.replace(/{YYYY}/g, String(yyyy));
  result = result.replace(/{HH}/g, hh);
  result = result.replace(/{mm}/g, mm_time);
  result = result.replace(/{counter}/g, String(counter));

  return result.trim() || title || "Recording";
}
