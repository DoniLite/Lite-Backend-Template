export * from "./storage.interface";
export * from "./local.storage";

import type { StorageProvider } from "./storage.interface";
import { LocalStorageProvider } from "./local.storage";
import { appConfig } from "../config/app.config";

let storageInstance: StorageProvider | null = null;

/**
 * Get the configured storage provider instance (singleton)
 */
export function getStorageProvider(): StorageProvider {
  if (!storageInstance) {
    const provider = appConfig.storage.provider;

    switch (provider) {
      case "local":
        storageInstance = new LocalStorageProvider();
        break;
      // Future: Add S3, GCS providers here
      // case 's3':
      //   storageInstance = new S3StorageProvider();
      //   break;
      default:
        storageInstance = new LocalStorageProvider();
    }
  }

  return storageInstance;
}
