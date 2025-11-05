/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.ts` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import './index.css';

(() => {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const info = document.getElementById('info') as HTMLSpanElement;
  const openBtn = document.getElementById('openBtn') as HTMLButtonElement;
  const exitBtn = document.getElementById('exitBtn') as HTMLButtonElement;

  let files: string[] = [];
  let idx = -1;
  let bitmap: ImageBitmap | null = null;
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let isPanning = false;
  let lastX = 0;
  let lastY = 0;
  let fitMode = 'contain';
  let smoothingTimer: NodeJS.Timeout | null = null;

  const AUTO_MOVE = true; // 自动切换到最佳显示器

  function setInfo(text: string) {
    info.textContent = text;
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  window.addEventListener('resize', () => {
    resizeCanvas();
    if (bitmap && fitMode === 'contain') fitToScreen();
  });

  function draw() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    if (!bitmap) {
      setInfo(
        '提示：点击“打开图片”或按 ←/→ 切换。滚轮缩放，拖拽平移，空格适应屏幕，Enter 移动到最佳显示器，F 全屏。',
      );
      return;
    }

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'low';

    if (smoothingTimer) {
      // 交互中使用低质量；停止一段时间后提升
    }

    const cx = w / 2 + offsetX;
    const cy = h / 2 + offsetY;

    const drawW = bitmap.width * scale;
    const drawH = bitmap.height * scale;

    ctx.drawImage(
      bitmap,
      0,
      0,
      bitmap.width,
      bitmap.height,
      cx - drawW / 2,
      cy - drawH / 2,
      drawW,
      drawH,
    );

    ctx.restore();

    const zoomPct = Math.round(scale * 100);
    const name = files[idx] ? files[idx].split(/[\\/]/).pop() : '';
    setInfo(`${name}  |  ${zoomPct}%  |  ${bitmap.width}×${bitmap.height}`);
  }

  function fitToScreen() {
    if (!bitmap) return;
    const vw = canvas.clientWidth;
    const vh = canvas.clientHeight;
    const s = Math.min(vw / bitmap.width, vh / bitmap.height);
    scale = s;
    offsetX = 0;
    offsetY = 0;
    fitMode = 'contain';
    draw();
  }

  function zoomAt(factor: number, clientX: number, clientY: number) {
    if (!bitmap) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // 将屏幕坐标转为图像坐标，保持指针处图像不动
    const cx = canvas.clientWidth / 2 + offsetX;
    const cy = canvas.clientHeight / 2 + offsetY;
    const imgXBefore = (x - (cx - (bitmap.width * scale) / 2)) / scale;
    const imgYBefore = (y - (cy - (bitmap.height * scale) / 2)) / scale;

    scale *= factor;
    fitMode = 'free';

    const imgXAfter = imgXBefore;
    const imgYAfter = imgYBefore;
    const newCx = x - imgXAfter * scale + (bitmap.width * scale) / 2;
    const newCy = y - imgYAfter * scale + (bitmap.height * scale) / 2;
    offsetX = newCx - canvas.clientWidth / 2;
    offsetY = newCy - canvas.clientHeight / 2;

    draw();

    if (smoothingTimer) clearTimeout(smoothingTimer);
    smoothingTimer = setTimeout(() => {
      ctx.imageSmoothingQuality = 'high';
      draw();
    }, 120);
  }

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const delta = e.deltaY;
      const factor = delta < 0 ? 1.1 : 1 / 1.1;
      zoomAt(factor, e.clientX, e.clientY);
    },
    { passive: false },
  );

  canvas.addEventListener('mousedown', (e) => {
    if (!bitmap) return;
    isPanning = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    offsetX += dx;
    offsetY += dy;
    fitMode = 'free';
    draw();
  });

  window.addEventListener('mouseup', () => {
    isPanning = false;
  });
  window.addEventListener('mouseleave', () => {
    isPanning = false;
  });

  async function openImages() {
    const paths = await window.viewer.openImagesDialog();
    if (!paths || paths.length === 0) return;
    files = paths;
    idx = 0;
    await loadIndex(idx);
  }

  async function loadIndex(i: number) {
    if (i < 0 || i >= files.length) return;
    idx = i;
    await loadFile(files[idx]);
  }

  async function loadFile(filePath: string) {
    bitmap?.close?.();
    bitmap = null;
    setInfo('加载中...');

    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = async () => {
        try {
          // 让 ImageBitmap 遵循 EXIF 方向
          bitmap = await createImageBitmap(img, {
            imageOrientation: 'from-image',
          });
          fitToScreen();
          draw();
          if (AUTO_MOVE && bitmap) {
            // 加载完成后自动移动到最佳显示器
            window.viewer.moveToBestDisplay(bitmap.width, bitmap.height);
          }
          resolve();
        } catch (err) {
          console.error(err);
          setInfo('解码失败');
          reject(err);
        }
      };
      img.onerror = (err) => {
        console.error(err);
        setInfo('加载失败');
        reject(err);
      };
      img.src =
        'file:///' +
        filePath.replace(/^([A-Za-z]):\\\\/, '$1:/').replace(/\\/g, '/');
    });
  }

  function next() {
    if (files.length) loadIndex((idx + 1) % files.length);
  }
  function prev() {
    if (files.length) loadIndex((idx - 1 + files.length) % files.length);
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') prev();
    else if (e.key === ' ') {
      e.preventDefault();
      fitToScreen();
    } else if (e.key === 'Enter') {
      if (bitmap) window.viewer.moveToBestDisplay(bitmap.width, bitmap.height);
    } else if (e.key.toLowerCase() === 'f') {
      if (!document.fullscreenElement)
        document.documentElement
          .requestFullscreen()
          .catch((err) => console.error(err));
      else document.exitFullscreen().catch((err) => console.error(err));
    } else if (e.key === '0') {
      fitToScreen();
    } else if (e.key === '1') {
      scale = 1;
      fitMode = 'free';
      draw();
    } else if (e.key === '2') {
      scale = 2;
      fitMode = 'free';
      draw();
    } else if (e.ctrlKey && e.key.toLowerCase() === 'o') {
      openImages();
    }
  });

  openBtn.addEventListener('click', openImages);

  exitBtn.addEventListener('click', () => {
    window.viewer.exit();
  });

  // 初始化
  resizeCanvas();
})();
