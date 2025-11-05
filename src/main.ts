import path from 'node:path';
import { app, BrowserWindow, ipcMain, screen, dialog } from 'electron';
import started from 'electron-squirrel-startup';

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'bmp'];

function isImageFile(filePath: string) {
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  return IMAGE_EXTS.includes(ext);
}

function pickBestDisplay(width: number, height: number) {
  const displays = screen.getAllDisplays();

  let best: {
    display: Electron.Display;
    ratio: number;
    orientationMatch: number;
    area: number;
  } | null = null;

  for (const display of displays) {
    const w = display.workArea.width;
    const h = display.workArea.height;
    const ratio = Math.min(w / width, h / height);
    const orientationMatch = Math.sign((w - h) * (width - height));
    const area = width * height * ratio * ratio;
    const cur = { display, ratio, orientationMatch, area };
    const better =
      !best ||
      cur.ratio > best.ratio ||
      (cur.ratio === best.ratio &&
        cur.orientationMatch > best.orientationMatch) ||
      (cur.ratio === best.ratio &&
        cur.orientationMatch === best.orientationMatch &&
        cur.area > best.area);
    if (better) best = cur;
  }

  return best?.display || displays[0];
}

ipcMain.handle(
  'viewer:move-to-best-display',
  (event, { width, height }: { width: number; height: number }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || !width || !height) return false;

    const target = pickBestDisplay(width, height);
    if (!target) return false;

    const wa = target.workArea;
    if (win.isFullScreen()) win.setFullScreen(false);
    win.setContentBounds(
      { x: wa.x, y: wa.y, width: wa.width, height: wa.height },
      true,
    );
    win.focus();
    return true;
  },
);

ipcMain.handle('dialog:open-images', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);

  const result = await dialog.showOpenDialog(win, {
    title: 'Open Images',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images', extensions: IMAGE_EXTS },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled) return [];
  return result.filePaths.filter(isImageFile);
});

ipcMain.handle('app:exit', () => {
  app.quit();
});

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    show: false,
    useContentSize: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: MAIN_WINDOW_VITE_DEV_SERVER_URL ? false : true,
    },
  });

  mainWindow.setMenuBarVisibility(true);

  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
