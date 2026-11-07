/**
 * src/core/testing/oracle/index.ts
 *
 * Unified Deep Output Oracle.
 * Sequentially executes:
 *   - Layer 1: Magic Bytes and Container Signature Verification
 *   - Layer 2: Real Browser Content Decoder (Web Audio, Video, Image, PDF, SheetJS, Mammoth, DOMParser)
 *   - Layer 3: Modifier Effect Auditor (verifies all requested options actually took effect)
 */

import type { ConversionModifiers } from '@/shared/types/conversionModifiers';
import type { OracleValidationResult } from '../types';
import { validateMagicBytes } from './magicBytes';
import { validateDecoder } from './decoderValidator';
import { auditModifiers } from './modifierAuditor';

export { validateMagicBytes } from './magicBytes';
export { validateDecoder } from './decoderValidator';
export { auditModifiers } from './modifierAuditor';

export async function validateOutput(
  data: Uint8Array,
  targetExt: string,
  modifiers?: ConversionModifiers,
  mimeType?: string,
  fileName?: string
): Promise<OracleValidationResult> {
  // Layer 1: Magic Bytes
  const layer1 = validateMagicBytes(data, targetExt, fileName);
  if (!layer1.valid) {
    return {
      valid: false,
      layer1,
      layer2: { valid: false, error: 'Ignorado devido a falha na Camada 1 (Magic Bytes inválidos).' },
      layer3: { valid: false, auditedModifiers: [], failures: [], error: 'Ignorado devido a falha na Camada 1.' },
      error: `[Camada 1 - Magic Bytes] ${layer1.error}`,
    };
  }

  // Layer 2: Real Decoder
  const layer2 = await validateDecoder(data, targetExt, mimeType, fileName);
  if (!layer2.valid) {
    return {
      valid: false,
      layer1,
      layer2,
      layer3: { valid: false, auditedModifiers: [], failures: [], error: 'Ignorado devido a falha na Camada 2 (Decodificador falhou).' },
      error: `[Camada 2 - Decodificador Real] ${layer2.error}`,
    };
  }

  // Layer 3: Modifier Audit
  const layer3 = auditModifiers(data, targetExt, modifiers, layer2.details, fileName);
  if (!layer3.valid) {
    return {
      valid: false,
      layer1,
      layer2,
      layer3,
      error: `[Camada 3 - Auditoria de Modificadores] ${layer3.error}`,
    };
  }

  return {
    valid: true,
    layer1,
    layer2,
    layer3,
  };
}
