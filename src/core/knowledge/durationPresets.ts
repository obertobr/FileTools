/**
 * src/core/knowledge/durationPresets.ts
 *
 * Central Knowledge Base for image-to-video duration presets.
 * Pure static data contracts — zero UI or business logic dependencies.
 */

export interface DurationPresetData {
  value: number;
  label: string;
  desc: string;
}

export const DURATION_PRESETS: DurationPresetData[] = [
  { value: 3, label: '3s', desc: 'Rápido' },
  { value: 5, label: '5s', desc: 'Curto' },
  { value: 10, label: '10s', desc: 'Padrão' },
  { value: 15, label: '15s', desc: 'Story/Reels' },
  { value: 30, label: '30s', desc: 'Médio' },
  { value: 60, label: '60s', desc: '1 minuto' },
];

export const DEFAULT_VIDEO_DURATION_SECONDS = 10;
