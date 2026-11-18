import type { ModularNodeExecutor, NodeArtifactPayload } from '@/core/graph/types';
import { getModuleById } from '@/modules/registry';
import { artifactToBytes, createPayloadFromBytes } from './nodeMediaUtils';

export const executeBatchProcessor: ModularNodeExecutor = async (inputs, config, context) => {
  const batchInput = inputs.batch;
  if (!batchInput || batchInput.kind !== 'batch' || !batchInput.batchItems?.length) {
    throw new Error('[Processador em Lote] Nenhum item encontrado na entrada batch.');
  }

  const moduleId = String(config.moduleId || 'ai-bg-remove');
  const targetFormat = String(config.targetFormat || '.png');
  const options = (config.options as Record<string, unknown>) || {};

  const mod = getModuleById(moduleId);
  if (!mod) {
    throw new Error(`[Processador em Lote] Módulo '${moduleId}' não encontrado no registro.`);
  }

  const items = batchInput.batchItems;
  const processedItems: NodeArtifactPayload[] = [];
  const total = items.length;

  context.onLog(`[Batch Processor] Executando '${mod.manifest.name}' em ${total} item(ns)...`);

  for (let i = 0; i < total; i++) {
    if (context.signal.aborted) {
      throw new DOMException('Execução em lote abortada pelo usuário.', 'AbortError');
    }

    const item = items[i];
    const bytes = await artifactToBytes(item);
    const res = await mod.execute(
      {
        file: item.file,
        fileData: bytes,
        originalName: item.fileName,
        targetFormat,
        options,
        modifiers: options,
      },
      {
        workspacePath: `/sessions/${context.sessionId}/${context.graphExecutionId}/nodes/${context.nodeId}/item_${i}`,
        onProgress: (itemPct) => {
          const globalPct = Math.round(((i + itemPct / 100) / total) * 100);
          context.onProgress(globalPct, `Lote ${i + 1}/${total} (${item.fileName})...`);
        },
        onLog: context.onLog,
      }
    );

    const outData = res.outputData
      ? (res.outputData as Uint8Array)
      : new Uint8Array(await (res.outputBlob as Blob).arrayBuffer());
    const outFileName = (res.outputFileName as string) || `${item.fileName}${targetFormat}`;
    const opfsPath = await context.writeOpfsArtifact(outFileName, outData);
    const nextItem = createPayloadFromBytes(outData, outFileName, item.dataType === 'image' ? 'image' : 'file', {
      sourceName: item.fileName,
      processedBy: moduleId,
    });
    if (opfsPath) nextItem.opfsPath = opfsPath;
    processedItems.push(nextItem);
  }

  context.onProgress(100, `Lote concluído (${processedItems.length}/${total} itens)!`);
  return {
    batch: {
      kind: 'batch',
      dataType: 'batch',
      fileName: `batch_${moduleId}`,
      mimeType: 'application/octet-stream',
      batchItems: processedItems,
      metadata: {
        moduleId,
        targetFormat,
        count: processedItems.length,
      },
    },
  };
};
