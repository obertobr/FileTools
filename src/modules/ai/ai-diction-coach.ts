import type { IModule, ExecutionContext } from '@/shared/types/module';
import { getMimeType } from '@/core/knowledge/mimeTypes';
import { markModelCached } from '@/core/ai/AIModelManager';
import { analyzeAcousticSpeech, decodeAnyAudioToPcm, mixToMono } from './aiUtils';

export interface DictionReport {
  durationSec: number;
  voicedDurationSec: number;
  silenceDurationSec: number;
  wpm: number;
  paceRating: 'Lento' | 'Ideal' | 'Rápido';
  pauseCount: number;
  snrDb: number;
  peakDb: number;
  clarityScore: number;
  referenceMatchRatio?: number;
  recommendations: string[];
}

export const AIDictionCoachModule: IModule = {
  manifest: {
    id: 'ai-diction-coach',
    name: 'IA Avaliador de Dicção & Oratória',
    version: '1.0.0',
    description: 'Avalia ritmo de fala (PPM), pausas longas, relação sinal-ruído e clareza articulatória.',
    category: 'ai',
    supportedModifiers: [],
    supportedConversions: [
      {
        from: ['.wav', '.mp3', '.ogg', '.m4a', '.webm'],
        to: ['.json', '.md'],
        lossy: false,
        speedScore: 91,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'Análise prosódica acústica + avaliação contra texto-alvo opcional',
      },
    ],
    inputs: [{ id: 'file', name: 'Speech Audio', type: 'file_handle', required: true }],
    outputs: [{ id: 'file', name: 'Diction Report', type: 'file_handle', required: true }],
  },

  isSupported: () => true,

  execute: async (inputs, context: ExecutionContext) => {
    const file = inputs.file as File | Blob | undefined;
    const fileData = inputs.fileData as Uint8Array | undefined;
    const originalName = (inputs.originalName as string) || 'speech.wav';
    const targetFormat = (inputs.targetFormat as string) || '.json';
    const options = (inputs.options || inputs.modifiers || {}) as Record<string, unknown>;

    if (!file && !fileData) {
      throw new Error('ai-diction-coach requires file or fileData.');
    }

    const inputExt = ('.' + (originalName.split('.').pop() || 'wav')).toLowerCase();
    const safeExt = targetFormat.toLowerCase().endsWith('.md') ? '.md' : '.json';
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + `_diction${safeExt}`;
    const mimeType = getMimeType(safeExt);

    context.onProgress(20, 'Extraindo envelope acústico da fala...');
    const bytes = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());
    const pcm = await decodeAnyAudioToPcm(bytes, inputExt);
    const mono = mixToMono(pcm);

    context.onProgress(60, 'Calculando PPM, pausas, SNR e nitidez articulatória...');
    const metrics = analyzeAcousticSpeech(mono, pcm.sampleRate);

    const paceRating: DictionReport['paceRating'] =
      metrics.estimatedWpm < 105 ? 'Lento' : metrics.estimatedWpm > 170 ? 'Rápido' : 'Ideal';

    const recommendations: string[] = [];
    if (metrics.snrDb < 14) {
      recommendations.push('Ruído ambiente elevado detectado (SNR baixo); grave mais próximo ao microfone ou use Limpeza de Ruído.');
    }
    if (metrics.pauseCount > 3) {
      recommendations.push(`Foram detectadas ${metrics.pauseCount} pausas prolongadas (>0.3s); tente manter maior fluidez entre frases.`);
    }
    if (paceRating === 'Rápido') {
      recommendations.push('Ritmo acima de 170 PPM; articule consoantes finais com mais calma para melhorar inteligibilidade.');
    } else if (paceRating === 'Lento') {
      recommendations.push('Ritmo abaixo de 105 PPM; encurte hesitações para ganhar naturalidade na locução.');
    }
    if (recommendations.length === 0) {
      recommendations.push('Excelente controle de ritmo, projeção vocal e articulação limpa.');
    }

    let referenceMatchRatio: number | undefined;
    const refText = typeof options.referenceText === 'string' ? options.referenceText.trim() : '';
    if (refText.length > 0) {
      const refWords = refText.split(/\s+/).filter(Boolean).length;
      const estimatedSpokenWords = Math.max(1, Math.round((metrics.estimatedWpm * metrics.durationSec) / 60));
      referenceMatchRatio = Number(Math.min(1, Math.min(refWords, estimatedSpokenWords) / Math.max(refWords, estimatedSpokenWords)).toFixed(2));
    }

    const report: DictionReport = {
      durationSec: metrics.durationSec,
      voicedDurationSec: metrics.voicedDurationSec,
      silenceDurationSec: metrics.silenceDurationSec,
      wpm: metrics.estimatedWpm,
      paceRating,
      pauseCount: metrics.pauseCount,
      snrDb: metrics.snrDb,
      peakDb: metrics.peakDb,
      clarityScore: metrics.clarityScore,
      ...(referenceMatchRatio !== undefined ? { referenceMatchRatio } : {}),
      recommendations,
    };

    const outputText =
      safeExt === '.md'
        ? [
            `# Relatório de Dicção e Oratória`,
            `- **Clareza Geral:** ${report.clarityScore}/100`,
            `- **Ritmo de Fala:** ${report.wpm} PPM (${report.paceRating})`,
            `- **Duração Total / Vocal:** ${report.durationSec}s / ${report.voicedDurationSec}s`,
            `- **Pausas Longas:** ${report.pauseCount}`,
            `- **SNR / Pico:** ${report.snrDb} dB / ${report.peakDb} dBFS`,
            report.referenceMatchRatio !== undefined ? `- **Aderência ao Roteiro:** ${Math.round(report.referenceMatchRatio * 100)}%` : '',
            ``,
            `## Recomendações`,
            ...report.recommendations.map((r) => `- ${r}`),
          ]
            .filter(Boolean)
            .join('\n')
        : JSON.stringify(report, null, 2);

    const outputData = new TextEncoder().encode(outputText);
    const outputBlob = new Blob([outputData.buffer as unknown as BlobPart], { type: mimeType });
    markModelCached('ai-diction-coach');

    context.onProgress(100, 'Avaliação de dicção concluída!');
    return {
      outputData,
      outputBlob,
      outputFileName,
      outputSize: outputData.byteLength,
      mimeType,
    };
  },
};
