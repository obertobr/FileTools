import { getMimeType } from '@/core/knowledge/mimeTypes';
import { getModuleById } from '@/modules/registry';
import { WorkerManager } from '@/core/engine/WorkerManager';
import {
  DEFAULT_CONVERSION_MODIFIERS,
  type ConversionModifiers,
  type ModifierCategoryId,
} from '@/shared/types/conversionModifiers';
import type { ConversionRoute } from '@/core/routing/conversionRouter';

const READ_STAGE_MODIFIERS = new Set<ModifierCategoryId>([
  'page_range',
  'cad_tessellation',
  'media_trim',
  'csv_delimiter',
  'archive_password',
  'audio_tracks',
  'subtitles',
  'threads',
]);

function filterModifiersForHop(
  modifiers: ConversionModifiers | undefined,
  hopIndex: number,
  totalHops: number
): ConversionModifiers {
  if (!modifiers) return DEFAULT_CONVERSION_MODIFIERS;
  if (totalHops === 1) return modifiers;

  const isFirst = hopIndex === 0;
  const isLast = hopIndex === totalHops - 1;

  if (!isFirst && !isLast) {
    return {
      ...DEFAULT_CONVERSION_MODIFIERS,
      activeCategories: modifiers.activeCategories.includes('threads') ? ['threads'] : [],
      qualityPreset: 'original',
      threadsMode: modifiers.threadsMode,
      userMaxThreads: modifiers.userMaxThreads,
      customThreads: modifiers.customThreads,
    };
  }

  if (isFirst) {
    const active = modifiers.activeCategories.filter((id) => READ_STAGE_MODIFIERS.has(id));
    return {
      ...DEFAULT_CONVERSION_MODIFIERS,
      activeCategories: active,
      pageRange: modifiers.pageRange,
      cadQuality: modifiers.cadQuality,
      trimStartSeconds: modifiers.trimStartSeconds,
      trimEndSeconds: modifiers.trimEndSeconds,
      csvDelimiter: modifiers.csvDelimiter,
      archivePassword: modifiers.archivePassword,
      selectedAudioTracks: modifiers.selectedAudioTracks,
      selectedSubtitleTracks: modifiers.selectedSubtitleTracks,
      keepAllSubtitles: modifiers.keepAllSubtitles,
      threadsMode: modifiers.threadsMode,
      userMaxThreads: modifiers.userMaxThreads,
      customThreads: modifiers.customThreads,
      qualityPreset: 'original',
    };
  }

  const active = modifiers.activeCategories.filter(
    (id) => !READ_STAGE_MODIFIERS.has(id) || id === 'archive_password' || id === 'csv_delimiter' || id === 'threads'
  );
  return {
    ...modifiers,
    activeCategories: active,
  };
}

async function runSingleHop(
  moduleId: string,
  inputs: Record<string, unknown>,
  onProgress: (p: number, msg?: string) => void,
  onLog: (msg: string) => void
): Promise<Record<string, unknown>> {
  if (typeof Worker !== 'undefined') {
    const manager = WorkerManager.getInstance();
    await manager.initialize();
    return manager.convert(moduleId, inputs, onProgress, onLog);
  }

  const mod = getModuleById(moduleId);
  if (!mod) {
    throw new Error(`[PipelineExecutor] Módulo não encontrado: ${moduleId}`);
  }

  const file = inputs.file as File | Blob | undefined;
  let fileData = inputs.fileData as Uint8Array | undefined;
  if (!fileData && file) {
    fileData = new Uint8Array(await file.arrayBuffer());
  }

  return mod.execute(
    {
      ...inputs,
      fileData,
    },
    {
      workspacePath: `/sessions/pipeline/${moduleId}`,
      onProgress,
      onLog,
    }
  );
}

export interface PipelineStageResult {
  outputBlob: Blob;
  outputData?: Uint8Array;
  outputFileName: string;
  outputSize: number;
  mimeType: string;
  stagesExecuted: number;
}

export async function executeConversionRoute(
  route: ConversionRoute,
  inputFile: File | Blob,
  originalName: string,
  modifiers: ConversionModifiers | undefined,
  onProgress: (p: number, msg?: string) => void,
  onLog: (msg: string) => void
): Promise<PipelineStageResult> {
  if (!route.hops || route.hops.length === 0) {
    throw new Error('[PipelineExecutor] Rota de conversão vazia.');
  }

  const baseName = originalName.replace(/\.[^.]+$/, '');
  const totalHops = route.hops.length;
  let currentFile: File | Blob = inputFile;
  let currentFileName = originalName;
  let currentData: Uint8Array | undefined;
  let lastResult: Record<string, unknown> = {};

  onLog(
    totalHops > 1
      ? `[Pipeline] Iniciando conversão em ${totalHops} etapas: ${route.label}`
      : `[Pipeline] Iniciando conversão direta: ${route.label}`
  );

  for (let i = 0; i < totalHops; i++) {
    const hop = route.hops[i];
    const targetDotExt = `.${hop.toExt.replace(/^\.+/, '').toLowerCase()}`;
    const hopLabel = `Etapa ${i + 1}/${totalHops}: .${hop.fromExt.toLowerCase()} → ${targetDotExt} (${hop.moduleName})`;

    onLog(`[Pipeline] ${hopLabel}`);
    const stageModifiers = filterModifiersForHop(modifiers, i, totalHops);

    const inputs: Record<string, unknown> = {
      file: currentFile,
      fileData: currentData,
      targetFormat: targetDotExt,
      originalName: currentFileName,
      options: stageModifiers,
      modifiers: stageModifiers,
      userMaxThreads:
        stageModifiers.threadsMode === 'custom'
          ? (stageModifiers.customThreads ?? stageModifiers.userMaxThreads)
          : undefined,
    };

    lastResult = await runSingleHop(
      hop.moduleId,
      inputs,
      (p, msg) => {
        const clamped = Math.max(0, Math.min(100, p));
        const overall = Math.round(((i + clamped / 100) / totalHops) * 100);
        const stageMsg = msg ? `${hopLabel} — ${msg}` : hopLabel;
        onProgress(overall, stageMsg);
      },
      onLog
    );

    const outBlob = lastResult.outputBlob as Blob | undefined;
    const outData = lastResult.outputData as Uint8Array | undefined;
    if (!outBlob && !outData) {
      throw new Error(`[Pipeline] Etapa ${i + 1} (${hop.moduleName}) não retornou dados.`);
    }

    const mime = (lastResult.mimeType as string) || getMimeType(targetDotExt);
    const nextFileName =
      i === totalHops - 1
        ? ((lastResult.outputFileName as string) || `${baseName}${targetDotExt}`)
        : `${baseName}_stage${i + 1}${targetDotExt}`;

    if (outBlob instanceof Blob) {
      currentFile = typeof File !== 'undefined' ? new File([outBlob], nextFileName, { type: mime }) : outBlob;
      currentData = outData;
    } else if (outData) {
      const blobPart = outData.buffer.slice(outData.byteOffset, outData.byteOffset + outData.byteLength) as BlobPart;
      const created = new Blob([blobPart], { type: mime });
      currentFile = typeof File !== 'undefined' ? new File([created], nextFileName, { type: mime }) : created;
      currentData = outData;
    }
    currentFileName = nextFileName;
  }

  let finalBlob: Blob;
  let finalData = lastResult.outputData as Uint8Array | undefined;
  const finalExt = `.${route.toExt.replace(/^\.+/, '').toLowerCase()}`;
  const finalMime = (lastResult.mimeType as string) || getMimeType(finalExt);
  const finalName = totalHops > 1
    ? `${baseName}${finalExt}`
    : ((lastResult.outputFileName as string) || `${baseName}${finalExt}`);

  if (lastResult.outputBlob instanceof Blob) {
    finalBlob = lastResult.outputBlob;
  } else if (finalData) {
    finalBlob = new Blob([finalData.buffer as unknown as BlobPart], { type: finalMime });
  } else {
    throw new Error('[Pipeline] Falha ao consolidar saída final.');
  }

  if (!finalData) {
    finalData = new Uint8Array(await finalBlob.arrayBuffer());
  }

  onProgress(100, 'Conversão concluída!');
  return {
    outputBlob: finalBlob,
    outputData: finalData,
    outputFileName: finalName,
    outputSize: finalBlob.size,
    mimeType: finalMime,
    stagesExecuted: totalHops,
  };
}
