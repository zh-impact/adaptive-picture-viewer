/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

declare global {
  interface Window {
    viewer: {
      moveToBestDisplay: (width: number, height: number) => Promise<boolean>;
      openImagesDialog: () => Promise<string[]>;
      platform: NodeJS.Platform;
      exit: () => void;
    };
  }
}

export {};
