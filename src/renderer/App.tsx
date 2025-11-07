import { useEffect, useRef } from 'react';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const infoRef = useRef<HTMLSpanElement>(null);

  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const filesRef = useRef<string[]>([]);
  const idxRef = useRef<number>(-1);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const scaleRef = useRef<number>(1);
  const offsetXRef = useRef<number>(0);
  const offsetYRef = useRef<number>(0);
  const isPanningRef = useRef<boolean>(false);
  const lastXRef = useRef<number>(0);
  const lastYRef = useRef<number>(0);
  const fitModeRef = useRef<'contain' | 'free'>('contain');
  const smoothingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const AUTO_MOVE = true;

  function setInfo(text: string) {
    const el = infoRef.current;
    if (el) el.textContent = text;
  }

  function draw() {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const bitmap = bitmapRef.current;
    if (!canvas || !ctx) return;

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

    const offsetX = offsetXRef.current;
    const offsetY = offsetYRef.current;
    const scale = scaleRef.current;

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
    const files = filesRef.current;
    const idx = idxRef.current;
    const name = files[idx] ? files[idx].split(/[\\/]/).pop() : '';
    setInfo(`${name}  |  ${zoomPct}%  |  ${bitmap.width}×${bitmap.height}`);
  }

  function resizeCanvas() {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function fitToScreen() {
    const canvas = canvasRef.current;
    const bitmap = bitmapRef.current;
    if (!canvas || !bitmap) return;
    const vw = canvas.clientWidth;
    const vh = canvas.clientHeight;
    const s = Math.min(vw / bitmap.width, vh / bitmap.height);
    scaleRef.current = s;
    offsetXRef.current = 0;
    offsetYRef.current = 0;
    fitModeRef.current = 'contain';
    draw();
  }

  function zoomAt(factor: number, clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    const bitmap = bitmapRef.current;
    if (!canvas || !bitmap) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const cx = canvas.clientWidth / 2 + offsetXRef.current;
    const cy = canvas.clientHeight / 2 + offsetYRef.current;
    const scale = scaleRef.current;
    const imgXBefore = (x - (cx - (bitmap.width * scale) / 2)) / scale;
    const imgYBefore = (y - (cy - (bitmap.height * scale) / 2)) / scale;

    const newScale = scale * factor;
    scaleRef.current = newScale;
    fitModeRef.current = 'free';

    const imgXAfter = imgXBefore;
    const imgYAfter = imgYBefore;
    const newCx = x - imgXAfter * newScale + (bitmap.width * newScale) / 2;
    const newCy = y - imgYAfter * newScale + (bitmap.height * newScale) / 2;
    offsetXRef.current = newCx - canvas.clientWidth / 2;
    offsetYRef.current = newCy - canvas.clientHeight / 2;

    draw();

    if (smoothingTimerRef.current) clearTimeout(smoothingTimerRef.current);
    smoothingTimerRef.current = setTimeout(() => {
      const ctx = ctxRef.current;
      if (ctx) {
        ctx.imageSmoothingQuality = 'high';
        draw();
      }
    }, 120);
  }

  async function openImages() {
    const paths = await window.viewer.openImagesDialog();
    if (!paths || paths.length === 0) return;
    filesRef.current = paths;
    idxRef.current = 0;
    await loadIndex(0);
  }

  async function loadIndex(i: number) {
    const files = filesRef.current;
    if (i < 0 || i >= files.length) return;
    idxRef.current = i;
    await loadFile(files[i]);
  }

  async function loadFile(filePath: string) {
    const prev = bitmapRef.current as ImageBitmap & { close?: () => void };
    try {
      prev?.close?.();
    } catch {
      void 0;
    }
    bitmapRef.current = null;
    setInfo('加载中...');

    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const bmp = await createImageBitmap(
            img,
            ({ imageOrientation: 'from-image' } as unknown) as ImageBitmapOptions,
          );
          bitmapRef.current = bmp;
          fitToScreen();
          draw();
          if (AUTO_MOVE && bmp) {
            window.viewer.moveToBestDisplay(bmp.width, bmp.height);
          }
          resolve();
        } catch (err) {
          console.error(err);
          setInfo('解码失败');
          reject(err);
        }
      };
      img.onerror = () => {
        console.error('image load error');
        setInfo('加载失败');
        reject(new Error('Image load error'));
      };
      img.src =
        'file:///' +
        filePath.replace(/^([A-Za-z]):\\\\/, '$1:/').replace(/\\/g, '/');
    });
  }

  function next() {
    const files = filesRef.current;
    const idx = idxRef.current;
    if (files.length) loadIndex((idx + 1) % files.length);
  }
  function prev() {
    const files = filesRef.current;
    const idx = idxRef.current;
    if (files.length) loadIndex((idx - 1 + files.length) % files.length);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
    if (!ctx) return;
    ctxRef.current = ctx;

    const handleResize = () => {
      resizeCanvas();
      if (bitmapRef.current && fitModeRef.current === 'contain') fitToScreen();
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      zoomAt(factor, e.clientX, e.clientY);
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (!bitmapRef.current) return;
      isPanningRef.current = true;
      lastXRef.current = e.clientX;
      lastYRef.current = e.clientY;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isPanningRef.current) return;
      const dx = e.clientX - lastXRef.current;
      const dy = e.clientY - lastYRef.current;
      lastXRef.current = e.clientX;
      lastYRef.current = e.clientY;
      offsetXRef.current += dx;
      offsetYRef.current += dy;
      fitModeRef.current = 'free';
      draw();
    };

    const stopPan = () => {
      isPanningRef.current = false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === ' ') {
        e.preventDefault();
        fitToScreen();
      } else if (e.key === 'Enter') {
        const bmp = bitmapRef.current;
        if (bmp) window.viewer.moveToBestDisplay(bmp.width, bmp.height);
      } else if (e.key.toLowerCase() === 'f') {
        if (!document.fullscreenElement)
          document.documentElement
            .requestFullscreen()
            .catch((err) => console.error(err));
        else document.exitFullscreen().catch((err) => console.error(err));
      } else if (e.key === '0') {
        fitToScreen();
      } else if (e.key === '1') {
        scaleRef.current = 1;
        fitModeRef.current = 'free';
        draw();
      } else if (e.key === '2') {
        scaleRef.current = 2;
        fitModeRef.current = 'free';
        draw();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'o') {
        openImages();
      }
    };

    window.addEventListener('resize', handleResize);
    canvas.addEventListener('wheel', handleWheel, { passive: false } as AddEventListenerOptions);
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopPan);
    window.addEventListener('mouseleave', stopPan);
    window.addEventListener('keydown', handleKeyDown);

    resizeCanvas();

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopPan);
      window.removeEventListener('mouseleave', stopPan);
      window.removeEventListener('keydown', handleKeyDown);
      if (smoothingTimerRef.current) {
        clearTimeout(smoothingTimerRef.current);
      }
    };
  }, []);

  const handleOpenClick = () => {
    openImages();
  };

  const handleExitClick = () => {
    if (window.viewer && typeof window.viewer.exit === 'function') window.viewer.exit();
  };

  return (
    <>
      <div id="toolbar">
        <div className="tool flex">
          <button id="openBtn" className="btn" onClick={handleOpenClick}>
            Open
          </button>
          <button id="exitBtn" className="btn" onClick={handleExitClick}>
            Exit
          </button>
        </div>
        <span id="info" ref={infoRef}></span>
      </div>

      <canvas id="canvas" ref={canvasRef}></canvas>
    </>
  );
}

export default App;

