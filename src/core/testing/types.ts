/**
 * src/core/testing/types.ts
 *
 * Core type definitions for the FileTools deep testing architecture.
 * Implements contracts for the 3-Layer Output Oracle, Production Runner,
 * and Delta Debugging diagnostics.
 */

import type {
  ConversionModifiers,
  ModifierCategoryId,
} from '@/shared/types/conversionModifiers';

export interface Layer1MagicBytesResult {
  valid: boolean;
  detectedSignature?: string;
  expectedSignature?: string;
  error?: string;
}

export interface DecodedMediaDetails {
  duration?: number;
  width?: number;
  height?: number;
  sampleRate?: number;
  channels?: number;
  pageCount?: number;
  sheetCount?: number;
  sheetNames?: string[];
  codec?: string;
  decodedBy: string;
}

export interface Layer2DecoderResult {
  valid: boolean;
  decoderName?: string;
  details?: DecodedMediaDetails;
  error?: string;
}

export interface ModifierAuditFailure {
  id: ModifierCategoryId;
  expected: unknown;
  actual: unknown;
  reason: string;
}

export interface Layer3ModifierAuditResult {
  valid: boolean;
  auditedModifiers: ModifierCategoryId[];
  failures: ModifierAuditFailure[];
  error?: string;
}

export interface OracleValidationResult {
  valid: boolean;
  layer1: Layer1MagicBytesResult;
  layer2: Layer2DecoderResult;
  layer3: Layer3ModifierAuditResult;
  error?: string;
}

export type FailureLayer = 1 | 2 | 3 | 'EXECUTION';

export interface ModifierPatch {
  id: ModifierCategoryId;
  description: string;
  patch: Partial<ConversionModifiers>;
}

export type DDminStatus =
  | 'PASS'
  | 'FAIL_BASELINE'
  | 'FAIL_SINGLETON'
  | 'FAIL_INTERACTION'
  | 'FAIL_CRASH';

export interface DDminResult {
  from: string;
  to: string;
  engineId: string;
  status: DDminStatus;
  iterations: number;
  maximalPassed: boolean;
  baselinePassed?: boolean;
  minimalFailingModifiers?: ModifierPatch[];
  failedLayer?: FailureLayer;
  oracleResult?: OracleValidationResult;
  error?: string;
  logs?: string[];
  durationMs: number;
}

export interface DiscoveredEngineBug {
  engineId: string;
  from: string;
  to: string;
  status: DDminStatus;
  failedLayer: FailureLayer;
  failureClassification: string;
  error: string;
  affectedModifiers?: string[];
  reproductionCommand: string;
  logs?: string[];
}

export interface TestRunOptions {
  from?: string;
  to?: string;
  engine?: string;
  file?: string;
  dd: boolean;
  all: boolean;
  verbose: boolean;
  baseline: boolean;
  allOptions: boolean;
  videoCodec?: string;
  audioCodec?: string;
  resolution?: string;
  fps?: number;
  quality?: string;
}

export interface ConversionPlanItem {
  from: string;
  to: string;
  engineId: string;
  engineName?: string;
}
