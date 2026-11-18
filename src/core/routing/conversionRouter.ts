import { categoryOfExtension, type Category } from '@/lib/formats';
import { getAllManifests, getModuleById, resolveAvailableEngines, type EngineOption } from '@/modules/registry';

export interface ConversionHop {
  fromExt: string;
  toExt: string;
  moduleId: string;
  moduleName: string;
  speedScore: number;
  acceleration: EngineOption['acceleration'];
  lossy: boolean;
}

export interface ConversionRoute {
  id: string;
  isMultiStage: boolean;
  fromExt: string;
  toExt: string;
  hops: ConversionHop[];
  intermediateFormats: string[];
  totalScore: number;
  label: string;
}

const LOSSLESS_HUBS = new Set(['PNG', 'WAV', 'GLB', 'TTF', 'PDF', 'HTML', 'EPUB', 'TAR', 'ZIP']);
const LOSSY_PENALTY_EXTS = new Set(['JPG', 'JPEG', 'GIF', 'MP3']);

function normExt(ext: string): string {
  return ext.trim().replace(/^\.+/, '').toUpperCase();
}

function isAllowedIntermediate(
  startExt: string,
  targetExt: string,
  candidateExt: string,
  _hopFromExt: string
): boolean {
  const cStart: Category = categoryOfExtension(startExt);
  const cTarget: Category = categoryOfExtension(targetExt);
  const cCand: Category = categoryOfExtension(candidateExt);

  if (cStart === 'model3d' && cTarget === 'model3d') {
    return cCand === 'model3d';
  }
  if (cStart === 'font' && cTarget === 'font') {
    return cCand === 'font';
  }
  if (cStart === 'archive' && cTarget === 'archive') {
    return cCand === 'archive';
  }
  if (cStart === 'image' && cTarget === 'image') {
    return cCand === 'image';
  }
  if (cStart === 'image' && targetExt === 'PDF') {
    return cCand === 'image';
  }
  if (startExt === 'PDF' && cTarget === 'image') {
    return cCand === 'image';
  }
  if ((cStart === 'video' || cStart === 'audio') && (cTarget === 'video' || cTarget === 'audio')) {
    return cCand === 'video' || cCand === 'audio';
  }
  if ((cStart === 'ebook' || cStart === 'document') && (cTarget === 'ebook' || cTarget === 'document')) {
    return cCand === 'ebook' || cCand === 'document';
  }
  if (cStart === 'ebook' && cTarget === 'image') {
    return cCand === 'ebook' || cCand === 'document' || cCand === 'image';
  }
  return false;
}

interface GraphEdge {
  fromExt: string;
  toExt: string;
  moduleId: string;
  moduleName: string;
  speedScore: number;
  acceleration: EngineOption['acceleration'];
  lossy: boolean;
}

function buildCapabilityEdges(): Map<string, GraphEdge[]> {
  const adj = new Map<string, GraphEdge[]>();
  const manifests = getAllManifests();

  for (const manifest of manifests) {
    if (manifest.category === 'ai') continue;

    for (const rule of manifest.supportedConversions) {
      for (const rawFrom of rule.from) {
        if (rawFrom === '*') continue;
        const fromExt = normExt(rawFrom);
        if (!adj.has(fromExt)) adj.set(fromExt, []);
        const bucket = adj.get(fromExt)!;

        for (const rawTo of rule.to) {
          const toExt = normExt(rawTo);
          if (toExt === fromExt) continue;
          bucket.push({
            fromExt,
            toExt,
            moduleId: manifest.id,
            moduleName: manifest.name,
            speedScore: rule.speedScore ?? 50,
            acceleration: rule.acceleration ?? 'cpu-singlethread',
            lossy: Boolean(rule.lossy),
          });
        }
      }
    }
  }

  for (const edges of adj.values()) {
    edges.sort((a, b) => b.speedScore - a.speedScore);
  }

  return adj;
}

function dedupeBestEdgePerTarget(edges: GraphEdge[]): GraphEdge[] {
  const bestByTarget = new Map<string, GraphEdge>();
  for (const edge of edges) {
    const existing = bestByTarget.get(edge.toExt);
    if (!existing || edge.speedScore > existing.speedScore) {
      bestByTarget.set(edge.toExt, edge);
    }
  }
  return Array.from(bestByTarget.values());
}

function scoreRoute(hops: ConversionHop[]): number {
  const minSpeed = hops.reduce((acc, h) => Math.min(acc, h.speedScore), 100);
  const avgSpeed = hops.reduce((acc, h) => acc + h.speedScore, 0) / hops.length;
  let score = minSpeed * 0.5 + avgSpeed * 0.5 - (hops.length - 1) * 18;

  for (let i = 0; i < hops.length - 1; i++) {
    const intermediate = hops[i].toExt;
    if (LOSSLESS_HUBS.has(intermediate)) score += 12;
    if (LOSSY_PENALTY_EXTS.has(intermediate)) score -= 25;
  }

  return Math.round(score);
}

export function resolveReachableTargets(
  sourceExt: string,
  _mimeType?: string,
  maxHops = 3
): string[] {
  const start = normExt(sourceExt);
  if (!start) return [];

  const adj = buildCapabilityEdges();
  const reachable = new Set<string>();
  const bestHopEdges = new Map<string, GraphEdge[]>();

  for (const [k, v] of adj.entries()) {
    bestHopEdges.set(k, dedupeBestEdgePerTarget(v));
  }

  const queue: Array<{ ext: string; depth: number }> = [{ ext: start, depth: 0 }];
  const minDepth = new Map<string, number>([[start, 0]]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= maxHops) continue;

    const edges = bestHopEdges.get(current.ext) || [];
    for (const edge of edges) {
      if (edge.toExt === start) continue;

      const isDirect = current.depth === 0;
      const validBridge =
        isDirect || isAllowedIntermediate(start, edge.toExt, current.ext, edge.fromExt);

      if (!validBridge) continue;

      reachable.add(edge.toExt);
      const nextDepth = current.depth + 1;
      if (nextDepth < maxHops) {
        const knownDepth = minDepth.get(edge.toExt);
        if (knownDepth === undefined || nextDepth < knownDepth) {
          minDepth.set(edge.toExt, nextDepth);
          queue.push({ ext: edge.toExt, depth: nextDepth });
        }
      }
    }
  }

  return Array.from(reachable);
}

export async function findOptimalConversionRoutes(
  sourceExt: string,
  targetExt: string,
  mimeType?: string,
  maxHops = 3
): Promise<ConversionRoute[]> {
  const start = normExt(sourceExt);
  const target = normExt(targetExt);
  if (!start || !target || start === target) return [];

  const directEngines = await resolveAvailableEngines(start, target, mimeType);
  if (directEngines.length > 0) {
    return directEngines.map((engine) => ({
      id: `direct:${engine.moduleId}`,
      isMultiStage: false,
      fromExt: start,
      toExt: target,
      hops: [
        {
          fromExt: start,
          toExt: target,
          moduleId: engine.moduleId,
          moduleName: engine.moduleName,
          speedScore: engine.speedScore,
          acceleration: engine.acceleration,
          lossy: false,
        },
      ],
      intermediateFormats: [],
      totalScore: engine.speedScore,
      label: `.${start.toLowerCase()} → .${target.toLowerCase()} (${engine.moduleName})`,
    }));
  }

  const adj = buildCapabilityEdges();
  const supportCache = new Map<string, boolean>();
  const isModuleSupported = async (moduleId: string): Promise<boolean> => {
    if (supportCache.has(moduleId)) return supportCache.get(moduleId)!;
    const mod = getModuleById(moduleId);
    let supported = false;
    if (mod) {
      try {
        supported = mod.isSupported ? await Promise.resolve(mod.isSupported()) : true;
      } catch {
        supported = false;
      }
    }
    supportCache.set(moduleId, supported);
    return supported;
  };

  const candidates: ConversionRoute[] = [];

  async function dfs(currentExt: string, hops: ConversionHop[], visited: Set<string>) {
    if (hops.length >= maxHops) return;

    const edges = dedupeBestEdgePerTarget(adj.get(currentExt) || []);
    for (const edge of edges) {
      if (visited.has(edge.toExt)) continue;
      if (!(await isModuleSupported(edge.moduleId))) continue;

      if (edge.toExt !== target && !isAllowedIntermediate(start, target, edge.toExt, currentExt)) {
        continue;
      }

      const nextHop: ConversionHop = {
        fromExt: edge.fromExt,
        toExt: edge.toExt,
        moduleId: edge.moduleId,
        moduleName: edge.moduleName,
        speedScore: edge.speedScore,
        acceleration: edge.acceleration,
        lossy: edge.lossy,
      };
      const nextHops = [...hops, nextHop];

      if (edge.toExt === target) {
        const intermediates = nextHops.slice(0, -1).map((h) => h.toExt);
        const chain = [start, ...nextHops.map((h) => h.toExt)].map((e) => `.${e.toLowerCase()}`).join(' → ');
        candidates.push({
          id: `pipeline:${nextHops.map((h) => `${h.moduleId}@${h.toExt}`).join('>')}`,
          isMultiStage: nextHops.length > 1,
          fromExt: start,
          toExt: target,
          hops: nextHops,
          intermediateFormats: intermediates,
          totalScore: scoreRoute(nextHops),
          label: `${chain}`,
        });
      } else if (nextHops.length < maxHops) {
        const nextVisited = new Set(visited);
        nextVisited.add(edge.toExt);
        await dfs(edge.toExt, nextHops, nextVisited);
      }
    }
  }

  await dfs(start, [], new Set([start]));

  candidates.sort((a, b) => {
    if (a.hops.length !== b.hops.length) return a.hops.length - b.hops.length;
    return b.totalScore - a.totalScore;
  });

  const uniqueRoutes: ConversionRoute[] = [];
  const seenSignatures = new Set<string>();
  for (const r of candidates) {
    const sig = r.hops.map((h) => `${h.moduleId}:${h.toExt}`).join('>');
    if (!seenSignatures.has(sig)) {
      seenSignatures.add(sig);
      uniqueRoutes.push(r);
    }
  }

  return uniqueRoutes.slice(0, 6);
}
