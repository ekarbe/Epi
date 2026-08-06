// Epi - Local-first Meeting Intelligence
// Copyright (C) 2026  Eike Christian Karbe
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

export type DocTab = 'setup' | 'features' | 'privacy' | 'advanced' | 'troubleshooting' | 'journey';

export type SupportedOS = 'linux' | 'windows' | 'macos';

export interface CodeSnippetProps {
  id: string;
  code: string;
  language?: string;
  title?: string;
}
