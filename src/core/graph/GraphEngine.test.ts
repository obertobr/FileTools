import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  computeTopologicalOrder,
  detectGraphCycles,
  isPortTypeCompatible,
  validateConnection,
} from './GraphValidator';
import { GraphEngine, exportFtGraph, importFtGraph } from './GraphEngine';
import type { GraphEdgeInstance, GraphNodeInstance } from './types';
import {
  GRAPH_TEMPLATES,
  buildPeriodicOverlayFilter,
  isOverlayActiveAtTimestamp,
} from '@/modules/nodes';
import { validateMagicBytes } from '@/core/testing/oracle/magicBytes';
import { decodeImageWithJSquash } from '@/modules/engines/jsquash';
import { extractEntriesSimple } from '@/modules/engines/fflate';

const FIXTURES_DIR = path.resolve(process.cwd(), 'tests/fixtures');

function readFixture(name: string): Uint8Array {
  return new Uint8Array(fs.readFileSync(path.join(FIXTURES_DIR, name)));
}

describe('GraphValidator & GraphEngine (Modular DAG Pipelines)', () => {
  it('enforces typed port compatibility and rejects mismatched connections', () => {
    expect(isPortTypeCompatible('video', 'video')).toBe(true);
    expect(isPortTypeCompatible('image', 'file')).toBe(true);
    expect(isPortTypeCompatible('file', 'video')).toBe(true);
    expect(isPortTypeCompatible('batch', 'batch')).toBe(true);

    expect(isPortTypeCompatible('audio', 'image')).toBe(false);
    expect(isPortTypeCompatible('batch', 'image')).toBe(false);
    expect(isPortTypeCompatible('image', 'batch')).toBe(false);
    expect(isPortTypeCompatible('subtitle', 'video')).toBe(false);
  });

  it('detects cycles in graphs and rejects cyclic connections', () => {
    const nodes: GraphNodeInstance[] = [
      {
        id: 'A',
        position: { x: 0, y: 0 },
        data: {
          kind: 'converter',
          label: 'A',
          config: {},
          inputs: [{ id: 'in', label: 'In', type: 'file' }],
          outputs: [{ id: 'out', label: 'Out', type: 'file' }],
        },
      },
      {
        id: 'B',
        position: { x: 100, y: 0 },
        data: {
          kind: 'converter',
          label: 'B',
          config: {},
          inputs: [{ id: 'in', label: 'In', type: 'file' }],
          outputs: [{ id: 'out', label: 'Out', type: 'file' }],
        },
      },
    ];
    const cyclicEdges: GraphEdgeInstance[] = [
      { id: 'e1', source: 'A', sourceHandle: 'out', target: 'B', targetHandle: 'in' },
      { id: 'e2', source: 'B', sourceHandle: 'out', target: 'A', targetHandle: 'in' },
    ];

    expect(detectGraphCycles(nodes, cyclicEdges).hasCycle).toBe(true);
    expect(() => computeTopologicalOrder(nodes, cyclicEdges)).toThrow(/Ciclo detectado/i);

    const check = validateConnection(
      { source: 'B', sourceHandle: 'out', target: 'A', targetHandle: 'in' },
      nodes,
      [cyclicEdges[0]]
    );
    expect(check.valid).toBe(false);
  });

  it('roundtrips .ftgraph JSON export and import without losing graph topology', () => {
    const tpl = GRAPH_TEMPLATES[0].graph;
    const exported = exportFtGraph(tpl.metadata.name, tpl.nodes, tpl.edges);
    const json = JSON.stringify(exported);
    const reimported = importFtGraph(json);

    expect(reimported.version).toBe('1.0.0');
    expect(reimported.nodes).toHaveLength(tpl.nodes.length);
    expect(reimported.edges).toHaveLength(tpl.edges.length);
  });

  it('builds exact FFmpeg periodic overlay filter expressions and timestamp schedules', () => {
    const expr = buildPeriodicOverlayFilter(5, 1, 16, 16);
    expect(expr).toBe("overlay=x=16:y=16:enable='lt(mod(t,5),1)'");

    expect(isOverlayActiveAtTimestamp(0.0, 5, 1)).toBe(true);
    expect(isOverlayActiveAtTimestamp(0.5, 5, 1)).toBe(true);
    expect(isOverlayActiveAtTimestamp(1.2, 5, 1)).toBe(false);
    expect(isOverlayActiveAtTimestamp(5.0, 5, 1)).toBe(true);
    expect(isOverlayActiveAtTimestamp(5.6, 5, 1)).toBe(true);
    expect(isOverlayActiveAtTimestamp(6.2, 5, 1)).toBe(false);
  });

  it('executes Pipeline 1 (Video + Image -> Periodic Overlay every 5s for 1s -> Output) and uses cache on re-run', async () => {
    const doc = GRAPH_TEMPLATES[0].graph;
    const mp4 = readFixture('sample.mp4');
    const png = readFixture('sample.png');
    const videoFile = new File([mp4.buffer as unknown as BlobPart], 'sample.mp4', { type: 'video/mp4' });
    const imgFile = new File([png.buffer as unknown as BlobPart], 'sample.png', { type: 'image/png' });

    const engine = new GraphEngine();
    const res1 = await engine.executeGraph(doc.nodes, doc.edges, {
      'in-video': videoFile,
      'in-image': imgFile,
    });

    expect(res1.executedNodeIds).toHaveLength(doc.nodes.length);
    const outPayload = res1.finalOutputs['out-final'];
    expect(outPayload).toBeDefined();
    expect(validateMagicBytes(outPayload.data!, 'mp4').valid).toBe(true);
    expect(Number(outPayload.metadata?.overlayAppliedFrames)).toBeGreaterThanOrEqual(2);

    // Second run with unchanged inputs & config must hit incremental node cache
    const res2 = await engine.executeGraph(doc.nodes, doc.edges, {
      'in-video': videoFile,
      'in-image': imgFile,
    });
    expect(res2.cachedNodeIds).toHaveLength(doc.nodes.length);
    expect(res2.executedNodeIds).toHaveLength(0);
  });

  it('executes Pipeline 2 (Video -> Frames -> Batch AI Background Remove -> Frames to Video -> Output)', async () => {
    const doc = GRAPH_TEMPLATES[1].graph;
    const mp4 = readFixture('sample.mp4');
    const videoFile = new File([mp4.buffer as unknown as BlobPart], 'sample.mp4', { type: 'video/mp4' });

    const engine = new GraphEngine();
    const res = await engine.executeGraph(doc.nodes, doc.edges, {
      'in-video': videoFile,
    });

    const batchOut = res.nodeOutputs['batch-ai']?.batch;
    expect(batchOut?.kind).toBe('batch');
    expect(batchOut?.batchItems?.length).toBeGreaterThanOrEqual(2);

    // Verify each batch frame returned by AI background removal actually contains transparent alpha pixels
    const firstFrameBytes = batchOut!.batchItems![0].data!;
    const decodedFrame = await decodeImageWithJSquash(firstFrameBytes, '.png');
    expect(decodedFrame.data[3]).toBe(0);

    const finalOut = res.finalOutputs['out-final'];
    expect(finalOut).toBeDefined();
    expect(validateMagicBytes(finalOut.data!, 'gif').valid).toBe(true);
  });

  it('packs batch output nodes cleanly into downloadable ZIP archive', async () => {
    const tpl = GRAPH_TEMPLATES[1].graph;
    const batchOnlyNodes: GraphNodeInstance[] = [
      tpl.nodes[0],
      tpl.nodes[1],
      tpl.nodes[2],
      {
        id: 'out-zip',
        position: { x: 900, y: 140 },
        data: {
          kind: 'output',
          label: 'ZIP Lote',
          config: {},
          inputs: [{ id: 'in', label: 'Lote', type: 'batch', required: true }],
          outputs: [],
        },
      },
    ];
    const batchOnlyEdges: GraphEdgeInstance[] = [
      tpl.edges[0],
      tpl.edges[1],
      { id: 'e3', source: 'batch-ai', sourceHandle: 'batch', target: 'out-zip', targetHandle: 'in' },
    ];

    const mp4 = readFixture('sample.mp4');
    const engine = new GraphEngine();
    const res = await engine.executeGraph(batchOnlyNodes, batchOnlyEdges, {
      'in-video': mp4,
    });

    const zipOut = res.finalOutputs['out-zip'];
    expect(validateMagicBytes(zipOut.data!, 'zip').valid).toBe(true);
    const extracted = extractEntriesSimple(zipOut.data!, '.zip', zipOut.fileName);
    expect(extracted.length).toBeGreaterThanOrEqual(2);
  });
});
