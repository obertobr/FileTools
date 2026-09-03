/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OPFSManager } from './OPFSManager';

describe('OPFSManager - Zelador (Garbage Collection)', () => {
  let mockRoot: any;
  let mockSessionsDir: any;

  beforeEach(() => {
    mockSessionsDir = {
      getDirectoryHandle: vi.fn(),
      removeEntry: vi.fn(),
      keys: vi.fn(),
    };

    mockRoot = {
      getDirectoryHandle: vi.fn().mockResolvedValue(mockSessionsDir),
    };

    // Mock navigator.storage.getDirectory
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        storage: {
          getDirectory: vi.fn().mockResolvedValue(mockRoot),
          estimate: vi.fn().mockResolvedValue({ quota: 1000, usage: 500 }),
        },
      },
      writable: true,
    });
  });

  it('deleta sessoes antigas e cria a pasta da sessao atual', async () => {
    // Mock the async iterator for keys()
    const oldSessions = ['session_1', 'session_2', 'session_current'];
    mockSessionsDir.keys.mockImplementation(async function* () {
      for (const key of oldSessions) {
        yield key;
      }
    });

    const currentSession = 'session_current';
    await OPFSManager.initialize(currentSession);

    // Deve checar se a pasta sessions/ existe
    expect(mockRoot.getDirectoryHandle).toHaveBeenCalledWith('sessions', { create: true });

    // Deve deletar session_1 e session_2, mas NÃƒO session_current
    expect(mockSessionsDir.removeEntry).toHaveBeenCalledWith('session_1', { recursive: true });
    expect(mockSessionsDir.removeEntry).toHaveBeenCalledWith('session_2', { recursive: true });
    expect(mockSessionsDir.removeEntry).not.toHaveBeenCalledWith('session_current', expect.any(Object));

    // Deve criar a pasta da sessÃ£o atual
    expect(mockSessionsDir.getDirectoryHandle).toHaveBeenCalledWith('session_current', { create: true });
  });

  it('verifica a cota (quota) de espaco corretamente', async () => {
    // 1000 - 500 = 500 available. 
    // Pedir 400 deve retornar true
    const hasSpace = await OPFSManager.checkQuota(400);
    expect(hasSpace).toBe(true);

    // Pedir 600 deve retornar false
    const hasNoSpace = await OPFSManager.checkQuota(600);
    expect(hasNoSpace).toBe(false);
  });
});

