/**
 * src/core/fs/OPFSManager.ts
 *
 * Origin Private File System (OPFS) Abstraction.
 * Manages workspaces for conversion tasks and garbage collection.
 */

export class OPFSManager {
  private static readonly ROOT_FOLDER = 'sessions';

  /**
   * Initializes the OPFS by ensuring the sessions/ root folder exists,
   * and deletes any session folder that doesn't match the current sessionId.
   * This acts as the "Zelador de Inicialização" (Janitor).
   */
  static async initialize(currentSessionId: string): Promise<void> {
    try {
      const root = await navigator.storage.getDirectory();
      const sessionsDir = await root.getDirectoryHandle(this.ROOT_FOLDER, { create: true });

      // In tests, sessionsDir.keys() might not be fully implemented in jsdom,
      // but in real browsers it's an async iterator.
      const entries: string[] = [];
      // @ts-ignore - async iterator is standard in File System Access API
      for await (const name of sessionsDir.keys()) {
        entries.push(name);
      }

      for (const folderName of entries) {
        if (folderName !== currentSessionId) {
          try {
            await sessionsDir.removeEntry(folderName, { recursive: true });
            console.debug(`[OPFS ZELADOR] Cleaned up old session: ${folderName}`);
          } catch (err) {
            console.warn(`[OPFS ZELADOR] Failed to clean up ${folderName}`, err);
          }
        }
      }

      // Create current session folder
      await sessionsDir.getDirectoryHandle(currentSessionId, { create: true });
      console.debug(`[OPFS] Initialized session: ${currentSessionId}`);
    } catch (error) {
      console.error('[OPFS] Failed to initialize OPFS', error);
      throw error;
    }
  }

  /**
   * Estimates available storage quota.
   * Returns true if there's enough space (e.g., > 1GB), false if critically low.
   * Note: The quota API can be inaccurate or restricted in some environments.
   */
  static async checkQuota(minimumBytes: number = 500 * 1024 * 1024): Promise<boolean> {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        if (estimate.quota !== undefined && estimate.usage !== undefined) {
          const available = estimate.quota - estimate.usage;
          return available >= minimumBytes;
        }
      } catch (err) {
        console.warn('[OPFS] Storage estimation failed', err);
      }
    }
    // Assume true if we can't estimate
    return true;
  }

  /**
   * Creates a dedicated workspace folder for a specific task.
   */
  static async createWorkspace(sessionId: string, taskId: string): Promise<FileSystemDirectoryHandle> {
    const root = await navigator.storage.getDirectory();
    const sessionsDir = await root.getDirectoryHandle(this.ROOT_FOLDER);
    const sessionDir = await sessionsDir.getDirectoryHandle(sessionId);
    return await sessionDir.getDirectoryHandle(taskId, { create: true });
  }

  /**
   * Deletes a task's workspace folder completely.
   */
  static async cleanupWorkspace(sessionId: string, taskId: string): Promise<void> {
    try {
      const root = await navigator.storage.getDirectory();
      const sessionsDir = await root.getDirectoryHandle(this.ROOT_FOLDER);
      const sessionDir = await sessionsDir.getDirectoryHandle(sessionId);
      await sessionDir.removeEntry(taskId, { recursive: true });
    } catch (err) {
      console.warn(`[OPFS] Failed to clean up workspace ${taskId}`, err);
    }
  }

  /**
   * Writes a File (or Blob) into the specified workspace.
   * Returns the FileSystemFileHandle for later use or passing to workers.
   */
  static async writeWorkspaceFile(
    workspace: FileSystemDirectoryHandle,
    filename: string,
    file: File | Blob
  ): Promise<FileSystemFileHandle> {
    const fileHandle = await workspace.getFileHandle(filename, { create: true });
    // @ts-ignore - createWritable is standard in OPFS
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();
    return fileHandle;
  }

  /**
   * Writes a ReadableStream directly into the specified workspace via pipeTo.
   * Zero heap memory accumulation.
   */
  static async writeWorkspaceStream(
    workspace: FileSystemDirectoryHandle,
    filename: string,
    stream: ReadableStream<Uint8Array>
  ): Promise<FileSystemFileHandle> {
    const fileHandle = await workspace.getFileHandle(filename, { create: true });
    // @ts-ignore - createWritable is standard in OPFS
    const writable = await fileHandle.createWritable();
    await stream.pipeTo(writable);
    return fileHandle;
  }

  /**
   * Reads a file from the workspace back into a File object.
   */
  static async readWorkspaceFile(
    workspace: FileSystemDirectoryHandle,
    filename: string
  ): Promise<File> {
    const fileHandle = await workspace.getFileHandle(filename);
    return await fileHandle.getFile();
  }
}

