// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('viewer', {
  moveToBestDisplay: (width: number, height: number) =>
    ipcRenderer.invoke('viewer:move-to-best-display', { width, height }),
  openImagesDialog: () => ipcRenderer.invoke('dialog:open-images'),
  platform: process.platform,
  exit: () => ipcRenderer.invoke('app:exit'),
});
