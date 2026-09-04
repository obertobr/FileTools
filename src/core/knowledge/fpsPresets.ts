/**
 * src/core/knowledge/fpsPresets.ts
 *
 * Central Knowledge Base for frame rate (FPS) presets and options.
 * Pure static data contracts — zero UI or business logic dependencies.
 */

export interface FpsPresetData {
  value: number;
  label: string;
}

export const FPS_PRESETS: Record<number, FpsPresetData> = {
  10: { value: 10, label: '10' },
  12: { value: 12, label: '12' },
  15: { value: 15, label: '15' },
  24: { value: 24, label: '24' },
  25: { value: 25, label: '25' },
  30: { value: 30, label: '30' },
  50: { value: 50, label: '50' },
  60: { value: 60, label: '60' },
  120: { value: 120, label: '120' },
};

export const DEFAULT_VIDEO_FPS_OPTIONS: number[] = [24, 25, 30, 50, 60];
export const DEFAULT_GIF_FPS_OPTIONS: number[] = [10, 12, 15, 24, 30];
