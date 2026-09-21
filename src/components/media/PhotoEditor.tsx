import { useRef, useEffect, useState, useCallback } from 'react';
import { useApp } from '../../store/AppContext';
import { X, RotateCw, Crop, Brush, Check, Undo2 } from 'lucide-react';

type FilterId = 'original' | 'bw' | 'vintage' | 'sharp' | 'warm' | 'cool';

const FILTERS: { id: FilterId; label: string; css: string; sharp?: boolean }[] = [
  { id: 'original', label: 'Original', css: 'none' },
  { id: 'bw', label: 'B & W', css: 'grayscale(1) contrast(1.1)' },
  { id: 'vintage', label: 'Vintage', css: 'sepia(0.6) contrast(1.05) saturate(1.2)' },
  { id: 'sharp', label: 'Sharp', css: 'contrast(1.35) saturate(1.15)', sharp: true },
  { id: 'warm', label: 'Warm', css: 'saturate(1.4) hue-rotate(-12deg) brightness(1.05)' },
  { id: 'cool', label: 'Cool', css: 'saturate(1.2) hue-rotate(18deg) brightness(1.02)' },
];

const MAX_CANVAS_SIDE = 1280;

/** Loads an image data URL into an HTMLImageElement. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = src;
  });
}

function applySharpening(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const px = Math.min(w - 1, Math.max(0, x + kx));
            const py = Math.min(h - 1, Math.max(0, y + ky));
            sum += src.data[(py * w + px) * 4 + c] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        out.data[(y * w + x) * 4 + c] = Math.max(0, Math.min(255, sum));
      }
      out.data[(y * w + x) * 4 + 3] = src.data[(y * w + x) * 4 + 3];
    }
  }
  ctx.putImageData(out, 0, 0);
}

export function PhotoEditor() {
  const { state, dispatch } = useApp();
  const source = state.photoEditorSource;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const [filter, setFilter] = useState<FilterId>('original');
  const [rotation, setRotation] = useState(0);
  const [crop, setCrop] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [tool, setTool] = useState<'none' | 'crop' | 'draw'>('none');
  const [brushColor, setBrushColor] = useState('#ff3b30');
  const [brushSize, setBrushSize] = useState(5);
  const [drawing, setDrawing] = useState(false);
  const [ready, setReady] = useState(false);
  const historyRef = useRef<ImageData[]>([]);

  // Load the (scaled) original into an offscreen base canvas
  useEffect(() => {
    let cancelled = false;
    if (!source) return;
    (async () => {
      try {
        const img = await loadImage(source);
        const scale = Math.min(1, MAX_CANVAS_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const base = document.createElement('canvas');
        base.width = w;
        base.height = h;
        base.getContext('2d')!.drawImage(img, 0, 0, w, h);
        baseRef.current = base;
        const canvas = canvasRef.current;
        if (canvas) { canvas.width = w; canvas.height = h; }
        historyRef.current = [];
        if (!cancelled) { setReady(true); setRotation(0); setFilter('original'); setCrop(null); setTool('none'); }
      } catch {
        dispatch({ type: 'SET_PHOTO_EDITOR_SOURCE', source: null });
      }
    })();
    return () => { cancelled = true; };
  }, [source, dispatch]);

  const renderBase = useCallback(() => {
    const canvas = canvasRef.current;
    const base = baseRef.current;
    if (!canvas || !base) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const meta = FILTERS.find(f => f.id === filter) || FILTERS[0];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.filter = meta.css === 'none' ? 'none' : meta.css;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(base, -canvas.width / 2, -canvas.height / 2);
    ctx.restore();
    ctx.filter = 'none';
    if (meta.sharp) applySharpening(ctx, canvas.width, canvas.height);
  }, [filter, rotation]);

  useEffect(() => { if (ready) renderBase(); }, [ready, renderBase]);

  const pushHistory = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    historyRef.current = [...historyRef.current.slice(-9), ctx.getImageData(0, 0, canvas.width, canvas.height)];
  };

  const undo = () => {
    const canvas = canvasRef.current;
    const last = historyRef.current.pop();
    if (!canvas || !last) return;
    canvas.getContext('2d')?.putImageData(last, 0, 0);
  };

  const rotate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    pushHistory();
    setRotation(r => (r + 90) % 360);
  };

  const canvasPoint = (e: React.MouseEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startDraw = (e: React.MouseEvent) => {
    if (tool !== 'draw') return;
    const point = canvasPoint(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (!point || !ctx) return;
    pushHistory();
    setDrawing(true);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const moveDraw = (e: React.MouseEvent) => {
    if (!drawing || tool !== 'draw') return;
    const point = canvasPoint(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (!point || !ctx) return;
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const endDraw = () => setDrawing(false);

  const confirmCrop = () => {
    const canvas = canvasRef.current;
    const base = baseRef.current;
    if (!canvas || !base || !crop) { setTool('none'); setCrop(null); return; }
    const c = canvas.getContext('2d');
    if (!c) return;
    const data = c.getImageData(Math.round(crop.x), Math.round(crop.y), Math.max(1, Math.round(crop.w)), Math.max(1, Math.round(crop.h)));
    const cropped = document.createElement('canvas');
    cropped.width = data.width;
    cropped.height = data.height;
    cropped.getContext('2d')!.putImageData(data, 0, 0);
    baseRef.current = cropped;
    canvas.width = data.width;
    canvas.height = data.height;
    historyRef.current = [];
    setCrop(null);
    setTool('none');
    renderBase();
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const edited = canvas.toDataURL('image/jpeg', 0.9);
    // Hand the edited image back to whatever opened the editor
    const index = state.pendingMediaFiles.findIndex(m => m.preview === source || m.dataUrl === source);
    if (index >= 0) {
      dispatch({
        type: 'SET_PENDING_MEDIA_FILE',
        index,
        media: { ...state.pendingMediaFiles[index], dataUrl: edited, preview: edited },
      });
    } else {
      dispatch({ type: 'SET_PENDING_MEDIA', files: [...state.pendingMediaFiles, { name: 'edited-photo.jpg', type: 'image/jpeg', size: Math.round(edited.length * 0.75), dataUrl: edited, preview: edited }] });
    }
    dispatch({ type: 'SET_PHOTO_EDITOR_SOURCE', source: null });
  };

  if (!state.isPhotoEditorOpen || !source) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col">
      <div className="flex items-center gap-3 px-4 h-[56px] border-b border-white/10 flex-shrink-0">
        <button onClick={() => dispatch({ type: 'SET_PHOTO_EDITOR_SOURCE', source: null })} className="p-1"><X size={20} className="text-white/70" /></button>
        <h2 className="text-base font-medium text-white flex-1">Photo Editor</h2>
        <button onClick={undo} className="p-2 rounded-full hover:bg-white/10" title="Undo"><Undo2 size={18} className="text-white/80" /></button>
        <button onClick={save} className="px-3 py-1.5 bg-tg-accent rounded-full text-white text-sm flex items-center gap-1"><Check size={16} /> Done</button>
      </div>

      <div className="flex-1 flex items-center justify-center p-3 overflow-hidden">
        <div className="relative max-h-full" style={{ maxWidth: '100%' }}>
          <canvas
            ref={canvasRef}
            onMouseDown={startDraw}
            onMouseMove={moveDraw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            className={`max-h-[60vh] max-w-full object-contain ${tool === 'draw' ? 'cursor-crosshair' : ''}`}
          />
          {tool === 'crop' && canvasRef.current && (
            <CropOverlay
              canvas={canvasRef.current}
              onChange={setCrop}
            />
          )}
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-white/10 p-3 space-y-3">
        <div className="flex gap-2 overflow-x-auto">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap ${filter === f.id ? 'bg-tg-accent text-white' : 'bg-white/10 text-white/70'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={rotate} className="px-3 py-1.5 rounded-full bg-white/10 text-white/80 text-xs flex items-center gap-1"><RotateCw size={14} /> Rotate</button>
          <button onClick={() => { setTool(tool === 'crop' ? 'none' : 'crop'); setCrop(null); }} className={`px-3 py-1.5 rounded-full text-xs flex items-center gap-1 ${tool === 'crop' ? 'bg-tg-accent text-white' : 'bg-white/10 text-white/80'}`}><Crop size={14} /> Crop</button>
          {tool === 'crop' && crop && <button onClick={confirmCrop} className="px-3 py-1.5 rounded-full bg-tg-green text-white text-xs">Apply crop</button>}
          <button onClick={() => setTool(tool === 'draw' ? 'none' : 'draw')} className={`px-3 py-1.5 rounded-full text-xs flex items-center gap-1 ${tool === 'draw' ? 'bg-tg-accent text-white' : 'bg-white/10 text-white/80'}`}><Brush size={14} /> Draw</button>
          {tool === 'draw' && (
            <>
              {['#ff3b30', '#ffd60a', '#30d158', '#0a84ff', '#ffffff'].map(c => (
                <button key={c} onClick={() => setBrushColor(c)} className={`w-6 h-6 rounded-full border-2 ${brushColor === c ? 'border-white' : 'border-transparent'}`} style={{ background: c }} />
              ))}
              <input type="range" min={2} max={20} value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} className="w-24" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CropOverlay({ canvas, onChange }: { canvas: HTMLCanvasElement; onChange: (crop: { x: number; y: number; w: number; h: number }) => void }) {
  const [rect, setRect] = useState({ x: 0.1, y: 0.1, w: 0.6, h: 0.6 });
  const dragRef = useRef<{ startX: number; startY: number } | null>(null);

  useEffect(() => {
    onChange({ x: rect.x * canvas.width, y: rect.y * canvas.height, w: rect.w * canvas.width, h: rect.h * canvas.height });
  }, [rect, canvas, onChange]);

  const onPointerDown = (e: React.MouseEvent) => {
    const rectEl = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragRef.current = { startX: e.clientX, startY: e.clientY };
    setRect({
      x: (e.clientX - rectEl.left) / rectEl.width,
      y: (e.clientY - rectEl.top) / rectEl.height,
      w: 0.2, h: 0.2,
    });
  };

  const onPointerMove = (e: React.MouseEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const rectEl = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x1 = (drag.startX - rectEl.left) / rectEl.width;
    const y1 = (drag.startY - rectEl.top) / rectEl.height;
    const x2 = (e.clientX - rectEl.left) / rectEl.width;
    const y2 = (e.clientY - rectEl.top) / rectEl.height;
    setRect({ x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) });
  };

  return (
    <div
      className="absolute inset-0 cursor-crosshair"
      onMouseDown={onPointerDown}
      onMouseMove={onPointerMove}
      onMouseUp={() => { dragRef.current = null; }}
    >
      <div
        className="absolute border-2 border-white"
        style={{
          left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%`,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
          background: 'transparent',
        }}
      />
    </div>
  );
}
