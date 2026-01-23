/* eslint-disable @typescript-eslint/no-explicit-any */
// Global registries for decorated classes

export const CONTROLLER_CLASSES = new Map<string, any>();
export const REPOSITORY_CLASSES = new Map<string, any>();
export const SERVICE_CLASSES = new Map<string, any>();
export const DTO_CLASSES = new Map<string, any>();

export function getAllControllers(): any[] {
  return Array.from(CONTROLLER_CLASSES.values());
}

export function getAllDTOs(): any[] {
  return Array.from(DTO_CLASSES.values());
}

export function getAllServices(): any[] {
  return Array.from(SERVICE_CLASSES.values());
}

export function getAllRepositories(): any[] {
  return Array.from(REPOSITORY_CLASSES.values());
}
