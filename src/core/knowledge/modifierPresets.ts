export interface PresetOption<T = string | number> {
  value: T;
  label: string;
  desc: string;
}

export const LOSSY_IMAGE_FORMATS = ['jpg', 'jpeg', 'webp', 'avif', 'jxl', 'heic', 'heif'];
export const ALPHA_CAPABLE_IMAGES = ['png', 'svg', 'webp', 'ico', 'tiff', 'tif', 'qoi', 'avif', 'gif'];
export const OPAQUE_IMAGE_TARGETS = ['jpg', 'jpeg', 'bmp'];

export const AUDIO_SAMPLE_RATE_PRESETS: PresetOption<number>[] = [
  { value: 8000, label: '8 kHz', desc: 'Telefonia / 3GP' },
  { value: 16000, label: '16 kHz', desc: 'Voz / STT IA' },
  { value: 22050, label: '22.05 kHz', desc: 'Rádio AM' },
  { value: 44100, label: '44.1 kHz', desc: 'CD Padrão' },
  { value: 48000, label: '48 kHz', desc: 'Vídeo / Studio' },
  { value: 96000, label: '96 kHz', desc: 'Hi-Res Audio' },
];

export const AUDIO_CHANNEL_PRESETS: PresetOption<number>[] = [
  { value: 1, label: 'Mono (1.0)', desc: 'Ideal para voz e menor tamanho' },
  { value: 2, label: 'Estéreo (2.0)', desc: 'Padrão música e vídeo' },
];

export const AUDIO_NORMALIZE_PRESETS: PresetOption<'off' | 'ebu-r128' | 'peak-0db'>[] = [
  { value: 'off', label: 'Original', desc: 'Sem alteração de ganho' },
  { value: 'ebu-r128', label: 'EBU R128', desc: 'Loudness broadcast (-14 LUFS)' },
  { value: 'peak-0db', label: 'Pico 0 dB', desc: 'Maximiza volume sem clipping' },
];

export const IMAGE_ROTATION_PRESETS: PresetOption<0 | 90 | 180 | 270>[] = [
  { value: 0, label: '0°', desc: 'Sem rotação' },
  { value: 90, label: '90°', desc: 'Sentido horário' },
  { value: 180, label: '180°', desc: 'Inverter' },
  { value: 270, label: '270°', desc: 'Anti-horário' },
];

export const BACKGROUND_COLOR_PRESETS: PresetOption<string>[] = [
  { value: '#ffffff', label: 'Branco', desc: '#FFFFFF' },
  { value: '#000000', label: 'Preto', desc: '#000000' },
  { value: '#10b981', label: 'Esmeralda', desc: '#10B981' },
];

export const ARCHIVE_COMPRESSION_PRESETS: PresetOption<number>[] = [
  { value: 0, label: '0 (Store)', desc: 'Sem compressão (instantâneo)' },
  { value: 1, label: '1 (Rápido)', desc: 'Compressão leve e veloz' },
  { value: 6, label: '6 (Padrão)', desc: 'Equilíbrio tamanho/tempo' },
  { value: 9, label: '9 (Ultra)', desc: 'Compressão máxima' },
];

export const SVG_PRECISION_PRESETS: PresetOption<number>[] = [
  { value: 1, label: '1 dígito', desc: 'Menor arquivo' },
  { value: 2, label: '2 dígitos', desc: 'Compacto' },
  { value: 3, label: '3 dígitos', desc: 'Padrão equilibrado' },
  { value: 5, label: '5 dígitos', desc: 'Alta precisão' },
];

export const CAD_TESSELLATION_PRESETS: PresetOption<'draft' | 'standard' | 'fine'>[] = [
  { value: 'draft', label: 'Rascunho', desc: 'Malha leve (preview rápido)' },
  { value: 'standard', label: 'Padrão', desc: 'Equilíbrio de polígonos' },
  { value: 'fine', label: 'Alta Precisão', desc: 'Ideal para impressão 3D / CAD' },
];

export const MESH_SCALE_PRESETS: PresetOption<number>[] = [
  { value: 1, label: '1x (Original)', desc: 'Escala nativa' },
  { value: 0.001, label: 'mm → m', desc: 'Escala 0.001x' },
  { value: 10, label: 'cm → mm', desc: 'Escala 10x' },
  { value: 1000, label: 'm → mm', desc: 'Escala 1000x' },
];

export const CSV_DELIMITER_PRESETS: PresetOption<string>[] = [
  { value: ',', label: 'Vírgula (,)', desc: 'CSV Internacional' },
  { value: ';', label: 'Ponto e Vírgula (;)', desc: 'CSV Excel PT-BR' },
  { value: '\t', label: 'Tabulação (TAB)', desc: 'TSV' },
  { value: '|', label: 'Pipe (|)', desc: 'Separador tabular' },
];
