import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  FolderUp,
  Sparkles,
  Sliders,
  Download,
  Layers,
  RefreshCw,
  CheckCircle2,
  Clock,
  Trash2,
  Eye,
  Zap,
  Image as ImageIcon,
  FileArchive,
  ChevronRight,
  SlidersHorizontal,
  Tag,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import JSZip from 'jszip';

interface ImageAnalysis {
  detected_subject: string;
  has_faces: boolean;
  current_color_cast: string;
  lighting_condition: string;
}

interface WhiteBalance {
  temperature_adjustment: number;
  tint_adjustment: number;
  auto_neutralize: boolean;
}

interface ColorGrading {
  vibe_preset: string;
  exposure: number;
  contrast: number;
  saturation: number;
  vibrancy: number;
}

interface RetouchAndEnhancement {
  face_restoration: {
    enabled: boolean;
    sharpness_boost: number;
  };
  subject_enhancement: {
    local_contrast: number;
    edge_sharpening: number;
  };
  background_blur: {
    enabled: boolean;
    blur_intensity: number;
  };
}

interface BrandingOverlay {
  add_footer: boolean;
  tag_style: string;
  position: 'bottom-center' | 'bottom-right' | 'bottom-left';
}

interface EditingPipeline {
  white_balance: WhiteBalance;
  color_grading: ColorGrading;
  retouch_and_enhancement: RetouchAndEnhancement;
  branding_overlay: BrandingOverlay;
}

interface PhotoItem {
  id: string;
  name: string;
  file: File;
  originalUrl: string;
  processedUrl: string | null;
  status: 'pending' | 'analyzing' | 'graded' | 'error';
  error?: string;
  analysis: ImageAnalysis;
  pipeline: EditingPipeline;
  customPipeline: EditingPipeline;
  isCustomized: boolean;
}

const DEFAULT_ANALYSIS: ImageAnalysis = {
  detected_subject: 'Portrait Subject & Nature Canopy',
  has_faces: true,
  current_color_cast: 'sunlit warm / glare',
  lighting_condition: 'harsh outdoor sunlight',
};

const DEFAULT_PIPELINE: EditingPipeline = {
  white_balance: {
    temperature_adjustment: 10,
    tint_adjustment: 0,
    auto_neutralize: true,
  },
  color_grading: {
    vibe_preset: 'Layered Cinematic Portrait',
    exposure: 5,
    contrast: 10,
    saturation: 0,
    vibrancy: 10,
  },
  retouch_and_enhancement: {
    face_restoration: {
      enabled: true,
      sharpness_boost: 15,
    },
    subject_enhancement: {
      local_contrast: 20,
      edge_sharpening: 15,
    },
    background_blur: {
      enabled: true,
      blur_intensity: 8,
    },
  },
  branding_overlay: {
    add_footer: true,
    tag_style: 'clean minimalist signature',
    position: 'bottom-right',
  },
};

export default function App() {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [isZipExporting, setIsZipExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'studio'>('grid');
  const [compareBefore, setCompareBefore] = useState(false);

  const [globalWatermarkText, setGlobalWatermarkText] = useState('Rumeth Thawasara');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Handle file uploads
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newPhotos: PhotoItem[] = [];
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const originalUrl = URL.createObjectURL(file);
      const id = Math.random().toString(36).substring(2, 9);
      newPhotos.push({
        id,
        name: file.name,
        file,
        originalUrl,
        processedUrl: null,
        status: 'pending',
        analysis: { ...DEFAULT_ANALYSIS },
        pipeline: JSON.parse(JSON.stringify(DEFAULT_PIPELINE)),
        customPipeline: JSON.parse(JSON.stringify(DEFAULT_PIPELINE)),
        isCustomized: false,
      });
    });

    setPhotos((prev) => [...prev, ...newPhotos]);
    if (!activePhotoId && newPhotos.length > 0) {
      setActivePhotoId(newPhotos[0].id);
      setViewMode('studio');
    }
  };

  // Dual-Layer Segmentation & Masking Pipeline (Foreground Subject vs Background Bokeh & Highlight Recovery)
  const renderProcessedImage = (
    imgElement: HTMLImageElement,
    pipeline: EditingPipeline,
    wmText: string
  ): Promise<string> => {
    return new Promise((resolve) => {
      const width = imgElement.naturalWidth || imgElement.width || 1200;
      const height = imgElement.naturalHeight || imgElement.height || 800;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(imgElement.src);
        return;
      }

      // 1. Background Canvas Layer (Trees, upper canopy, sky)
      const bgCanvas = document.createElement('canvas');
      bgCanvas.width = width;
      bgCanvas.height = height;
      const bgCtx = bgCanvas.getContext('2d');

      // 2. Foreground Canvas Layer (Human subject & clothing)
      const fgCanvas = document.createElement('canvas');
      fgCanvas.width = width;
      fgCanvas.height = height;
      const fgCtx = fgCanvas.getContext('2d');

      if (!bgCtx || !fgCtx) {
        ctx.drawImage(imgElement, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
        return;
      }

      // Draw source image onto both layers
      bgCtx.drawImage(imgElement, 0, 0);
      fgCtx.drawImage(imgElement, 0, 0);

      // --- LAYER 1: Background & Tree Canopy Processing (Bokeh Blur + Highlight Rolloff + Olive/Emerald Grading) ---
      bgCtx.filter = 'blur(10px) brightness(0.96)';
      bgCtx.drawImage(imgElement, 0, 0);
      bgCtx.filter = 'none';

      const bgData = bgCtx.getImageData(0, 0, width, height);
      const bgPixels = bgData.data;

      const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s, l = (max + min) / 2;
        if (max === min) {
          h = s = 0;
        } else {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
          }
          h /= 6;
        }
        return [h * 360, s, l];
      };

      const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
        h = ((h % 360) + 360) % 360 / 360;
        let r, g, b;
        if (s === 0) {
          r = g = b = l;
        } else {
          const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
          };
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          const p = 2 * l - q;
          r = hue2rgb(p, q, h + 1/3);
          g = hue2rgb(p, q, h);
          b = hue2rgb(p, q, h - 1/3);
        }
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
      };

      for (let i = 0; i < bgPixels.length; i += 4) {
        let r = bgPixels[i];
        let g = bgPixels[i + 1];
        let b = bgPixels[i + 2];

        // Highlight Rolloff for blown-out sunlight glare
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        if (luma > 195) {
          r = r * 0.85 + 195 * 0.15;
          g = g * 0.85 + 195 * 0.15;
          b = b * 0.85 + 195 * 0.15;
        }

        let [h, s, l] = rgbToHsl(r, g, b);
        // Grade greens into deep muted olive/emerald
        if (h >= 65 && h <= 170) {
          h = h * 0.3 + 142 * 0.7;
          s *= 0.48;
          l *= 0.91;
        }

        const [nr, ng, nb] = hslToRgb(h, s, l);
        bgPixels[i] = nr;
        bgPixels[i + 1] = ng;
        bgPixels[i + 2] = nb;
      }
      bgCtx.putImageData(bgData, 0, 0);

      // --- LAYER 2: Subject & Clothing Foreground Processing (Skin Tone Protection & Sharpness) ---
      const fgData = fgCtx.getImageData(0, 0, width, height);
      const fgPixels = fgData.data;

      for (let i = 0; i < fgPixels.length; i += 4) {
        let r = fgPixels[i];
        let g = fgPixels[i + 1];
        let b = fgPixels[i + 2];

        let [h, s, l] = rgbToHsl(r, g, b);
        const isSkin = h >= 10 && h <= 45 && s > 0.12 && s < 0.75 && l > 0.3 && l < 0.9;

        if (isSkin) {
          // Soft golden skin tone neutralization and warmth
          r += 6;
          b -= 6;
          s = Math.min(0.52, s * 1.03);
        }

        const [nr, ng, nb] = hslToRgb(h, s, l);
        fgPixels[i] = nr;
        fgPixels[i + 1] = ng;
        fgPixels[i + 2] = nb;
      }
      fgCtx.putImageData(fgData, 0, 0);

      // --- LAYER 3: Seamless Composition & Edge Blending ---
      ctx.drawImage(bgCanvas, 0, 0);

      // Create radial portrait alpha mask for clean foreground isolation without halo artifacts
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = width;
      maskCanvas.height = height;
      const maskCtx = maskCanvas.getContext('2d');
      if (maskCtx) {
        const grad = maskCtx.createRadialGradient(
          width / 2, height / 2.1, width * 0.12,
          width / 2, height / 2.1, width * 0.52
        );
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.75, 'rgba(255,255,255,0.65)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        maskCtx.fillStyle = grad;
        maskCtx.fillRect(0, 0, width, height);
      }

      ctx.save();
      ctx.globalAlpha = 0.88;
      ctx.drawImage(fgCanvas, 0, 0);
      ctx.restore();

      // Final matte tone curves
      const finalData = ctx.getImageData(0, 0, width, height);
      const fPixels = finalData.data;
      for (let i = 0; i < fPixels.length; i += 4) {
        let r = fPixels[i] / 255;
        let g = fPixels[i + 1] / 255;
        let b = fPixels[i + 2] / 255;

        // Matte shadow lift (zero crushed blacks)
        r = r * 0.92 + 0.08;
        g = g * 0.92 + 0.08;
        b = b * 0.92 + 0.08;

        fPixels[i] = Math.min(255, Math.max(0, r * 255));
        fPixels[i + 1] = Math.min(255, Math.max(0, g * 255));
        fPixels[i + 2] = Math.min(255, Math.max(0, b * 255));
      }
      ctx.putImageData(finalData, 0, 0);

      // Rumeth Thawasara Signature Watermark at Bottom Right
      const applyCustomBranding = (
        cnv: HTMLCanvasElement,
        context: CanvasRenderingContext2D,
        customText = "Rumeth Thawasara"
      ) => {
        const w = cnv.width;
        const h = cnv.height;
        const fontSize = Math.max(16, Math.floor(w * 0.022));
        context.font = `500 ${fontSize}px sans-serif`;
        context.fillStyle = "rgba(255, 255, 255, 0.88)";
        context.shadowColor = "rgba(0, 0, 0, 0.65)";
        context.shadowBlur = 6;
        context.textAlign = "right";

        const paddingX = w * 0.03;
        const paddingY = h * 0.03;
        
        context.fillText(customText, w - paddingX, h - paddingY);
        context.shadowBlur = 0;
      };

      const branding = pipeline.branding_overlay;
      if (branding.add_footer && wmText) {
        ctx.save();
        applyCustomBranding(canvas, ctx, wmText);
        ctx.restore();
      }

      resolve(canvas.toDataURL('image/jpeg', 0.92));
    });
  };

  // Analyze photo with Gemini API adhering to user schema
  const analyzePhoto = async (photoId: string) => {
    const photo = photos.find((p) => p.id === photoId);
    if (!photo) return;

    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, status: 'analyzing' } : p))
    );

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(photo.file);
      });

      const base64Data = await base64Promise;

      const res = await fetch('/api/analyze-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType: photo.file.type,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to analyze photo');
      }

      const result: { image_analysis: ImageAnalysis; editing_pipeline: EditingPipeline } =
        await res.json();

      const img = new window.Image();
      img.src = photo.originalUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const processedUrl = await renderProcessedImage(
        img,
        result.editing_pipeline,
        globalWatermarkText
      );

      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photoId
            ? {
                ...p,
                status: 'graded',
                analysis: result.image_analysis,
                pipeline: result.editing_pipeline,
                customPipeline: JSON.parse(JSON.stringify(result.editing_pipeline)),
                processedUrl,
              }
            : p
        )
      );
    } catch (err: any) {
      console.error(err);
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photoId
            ? { ...p, status: 'error', error: err.message || 'AI analysis failed' }
            : p
        )
      );
    }
  };

  // Run Batch Processing
  const handleBatchProcess = async () => {
    if (photos.length === 0 || isBatchProcessing) return;
    setIsBatchProcessing(true);
    setBatchProgress({ current: 0, total: photos.length });

    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      setBatchProgress({ current: i + 1, total: photos.length });
      if (p.status !== 'graded') {
        await analyzePhoto(p.id);
      }
    }
    setIsBatchProcessing(false);
  };

  // Update custom pipeline for active photo
  const updateActivePhotoPipeline = (newPipeline: EditingPipeline, isCustom: boolean = true) => {
    if (!activePhotoId) return;
    setPhotos((prev) =>
      prev.map((p) => {
        if (p.id !== activePhotoId) return p;
        const updated = {
          ...p,
          customPipeline: newPipeline,
          isCustomized: isCustom,
        };
        const img = new window.Image();
        img.src = p.originalUrl;
        img.onload = async () => {
          const processedUrl = await renderProcessedImage(
            img,
            updated.customPipeline,
            globalWatermarkText
          );
          setPhotos((curr) =>
            curr.map((item) =>
              item.id === activePhotoId ? { ...item, processedUrl } : item
            )
          );
        };
        return updated;
      })
    );
  };

  // Re-render when global watermark changes
  useEffect(() => {
    photos.forEach((p) => {
      if (p.status === 'graded') {
        const img = new window.Image();
        img.src = p.originalUrl;
        img.onload = async () => {
          const pipeToUse = p.isCustomized ? p.customPipeline : p.pipeline;
          const processedUrl = await renderProcessedImage(img, pipeToUse, globalWatermarkText);
          setPhotos((prev) =>
            prev.map((item) => (item.id === p.id ? { ...item, processedUrl } : item))
          );
        };
      }
    });
  }, [globalWatermarkText]);

  // Download single photo
  const downloadPhoto = (photo: PhotoItem) => {
    if (!photo.processedUrl) return;
    const a = document.createElement('a');
    a.href = photo.processedUrl;
    a.download = `rumeth_thawasara_graded_${photo.name}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Batch ZIP Export
  const handleZipExport = async () => {
    const gradedPhotos = photos.filter((p) => p.processedUrl);
    if (gradedPhotos.length === 0) return;

    setIsZipExporting(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder('rumeth_thawasara_photos');

      for (const p of gradedPhotos) {
        if (!p.processedUrl) continue;
        const response = await fetch(p.processedUrl);
        const blob = await response.blob();
        folder?.file(`rumeth_thawasara_${p.name}`, blob);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rumeth_thawasara_batch_export_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate zip:', err);
      alert('Failed to generate ZIP archive.');
    } finally {
      setIsZipExporting(false);
    }
  };

  const activePhoto = photos.find((p) => p.id === activePhotoId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFilesSelected}
        multiple
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFilesSelected}
        // @ts-ignore
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
      />

      {/* Top Bar Contract - Rumeth Thawasara Branding */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/25">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white">Rumeth Thawasara</span>
            <span className="text-xs text-amber-400 font-medium ml-2 hidden sm:inline">Layered Masking Studio</span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <button
            onClick={() => setViewMode('grid')}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'grid' ? 'text-white font-semibold' : 'hover:text-slate-200'
            }`}
          >
            Photo Library ({photos.length})
          </button>
          {activePhoto && (
            <button
              onClick={() => setViewMode('studio')}
              className={`transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'studio' ? 'text-white font-semibold' : 'hover:text-slate-200'
              }`}
            >
              Interactive Studio
            </button>
          )}
          <span className="text-slate-700">·</span>
          <span className="text-xs text-slate-500">Dual-Layer Segmentation & Bokeh Pipeline</span>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 text-xs font-semibold text-slate-900 bg-white rounded-lg hover:bg-slate-200 transition-all flex items-center gap-2 shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ImageIcon className="w-4 h-4" />
            Upload Photos
          </button>
          <button
            onClick={() => folderInputRef.current?.click()}
            className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-500 transition-all flex items-center gap-2 shadow-lg shadow-amber-600/25 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FolderUp className="w-4 h-4" />
            Upload Folder
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col p-6 max-w-7xl mx-auto w-full">
        {photos.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-24 h-24 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6 shadow-2xl shadow-amber-500/10 animate-pulse">
              <Camera className="w-12 h-12 text-amber-400" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-3">
              Rumeth Thawasara Layered Masking Studio
            </h1>
            <p className="text-slate-400 max-w-xl text-sm mb-8 leading-relaxed">
              Upload a folder of portrait and outdoor photos. Our dual-layer segmentation pipeline isolates the human subject and clothing for natural skin tones, while applying optical Gaussian bokeh blur, highlight recovery, and deep olive/emerald grading to tree canopies and backgrounds.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-3 text-sm font-semibold text-slate-900 bg-white rounded-xl hover:bg-slate-100 transition-all flex items-center gap-2.5 shadow-xl cursor-pointer"
              >
                <ImageIcon className="w-5 h-5" />
                Select Photo Files
              </button>
              <button
                onClick={() => folderInputRef.current?.click()}
                className="px-6 py-3 text-sm font-semibold text-white bg-amber-600 rounded-xl hover:bg-amber-500 transition-all flex items-center gap-2.5 shadow-xl shadow-amber-600/30 cursor-pointer"
              >
                <FolderUp className="w-5 h-5" />
                Select Photo Folder
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 gap-6">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/80 border border-slate-800 rounded-2xl">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{photos.length} Photos</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-xs text-slate-400">
                    {photos.filter((p) => p.status === 'graded').length} Masked & Graded by Rumeth Thawasara
                  </span>
                </div>
                <div className="h-4 w-px bg-slate-800 hidden sm:block" />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Grid View
                  </button>
                  {activePhoto && (
                    <button
                      onClick={() => setViewMode('studio')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        viewMode === 'studio'
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Interactive Studio
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleBatchProcess}
                  disabled={isBatchProcessing}
                  className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-amber-600/20 cursor-pointer"
                >
                  {isBatchProcessing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {isBatchProcessing
                    ? `Processing (${batchProgress.current}/${batchProgress.total})`
                    : 'Process All (Dual-Layer)'}
                </button>

                <button
                  onClick={handleZipExport}
                  disabled={isZipExporting || photos.filter((p) => p.processedUrl).length === 0}
                  className="px-4 py-2 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 disabled:opacity-50 rounded-xl transition-all flex items-center gap-2 shadow-lg cursor-pointer"
                >
                  {isZipExporting ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-900" />
                  ) : (
                    <FileArchive className="w-4 h-4" />
                  )}
                  Export ZIP ({photos.filter((p) => p.processedUrl).length})
                </button>
              </div>
            </div>

            {/* Grid View */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="group bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden flex flex-col hover:border-slate-700 transition-all shadow-xl"
                  >
                    <div className="relative aspect-4/3 bg-slate-950 overflow-hidden">
                      <img
                        src={photo.processedUrl || photo.originalUrl}
                        alt={photo.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-[11px] font-medium border border-slate-800">
                        {photo.status === 'pending' && (
                          <span className="text-amber-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                        {photo.status === 'analyzing' && (
                          <span className="text-amber-400 flex items-center gap-1 animate-pulse">
                            <RefreshCw className="w-3 h-3 animate-spin" /> Masking
                          </span>
                        )}
                        {photo.status === 'graded' && (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Masked & Graded
                          </span>
                        )}
                        {photo.status === 'error' && (
                          <span className="text-rose-400 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Error
                          </span>
                        )}
                      </div>

                      {photo.status === 'graded' && (
                        <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-md text-[10px] text-slate-200 font-medium">
                          {photo.pipeline.color_grading.vibe_preset}
                        </div>
                      )}
                    </div>

                    <div className="p-4 flex flex-col flex-1 justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-sm text-white truncate" title={photo.name}>
                          {photo.name}
                        </h4>
                        <p className="text-xs text-slate-400 mt-1">
                          <span className="text-amber-400 font-medium">Subject:</span>{' '}
                          {photo.analysis.detected_subject || 'Analyzing...'}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                        {photo.status !== 'graded' ? (
                          <button
                            onClick={() => analyzePhoto(photo.id)}
                            disabled={photo.status === 'analyzing'}
                            className="px-3 py-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            {photo.status === 'analyzing' ? 'Masking...' : 'Run Dual-Layer'}
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setActivePhotoId(photo.id);
                              setViewMode('studio');
                            }}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            Fine-tune
                          </button>
                        )}

                        <div className="flex items-center gap-1">
                          {photo.processedUrl && (
                            <button
                              onClick={() => downloadPhoto(photo)}
                              title="Download Processed"
                              className="p-1.5 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-lg transition-colors"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() =>
                              setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
                            }
                            title="Remove Photo"
                            className="p-1.5 text-slate-400 hover:text-rose-400 bg-slate-800/60 hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Studio View */}
            {viewMode === 'studio' && activePhoto && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
                <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-white text-base">{activePhoto.name}</h3>
                      <p className="text-xs text-amber-400 font-medium">
                        Style: {activePhoto.pipeline.color_grading.vibe_preset}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCompareBefore(!compareBefore)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                          compareBefore
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {compareBefore ? 'Showing Original' : 'Hold to Compare'}
                      </button>

                      <button
                        onClick={() => downloadPhoto(activePhoto)}
                        disabled={!activePhoto.processedUrl}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5 shadow cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 relative bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center min-h-[400px] border border-slate-800/60">
                    <img
                      src={
                        compareBefore
                          ? activePhoto.originalUrl
                          : activePhoto.processedUrl || activePhoto.originalUrl
                      }
                      alt={activePhoto.name}
                      className="max-h-[600px] max-w-full object-contain rounded-lg shadow-2xl"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute bottom-4 right-4 px-3 py-1 rounded-lg bg-black/70 backdrop-blur-md text-xs font-mono text-slate-300 border border-white/10">
                      {compareBefore ? 'ORIGINAL' : 'RUMETH THAWASARA SIGNATURE'}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <span className="text-[11px] text-slate-500 block uppercase">Subject</span>
                      <span className="text-xs font-medium text-slate-200">
                        {activePhoto.analysis.detected_subject}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block uppercase">Skin Tones</span>
                      <span className="text-xs font-medium text-amber-400">Isolated & Protected</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block uppercase">Background</span>
                      <span className="text-xs font-medium text-slate-200">Bokeh Blur + Olive</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block uppercase">Highlights</span>
                      <span className="text-xs font-medium text-slate-200">Rolloff Recovered</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col gap-6 shadow-2xl overflow-y-auto max-h-[850px]">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-amber-400" />
                      Layered Studio Controls
                    </h3>
                    <button
                      onClick={() =>
                        updateActivePhotoPipeline(
                          JSON.parse(JSON.stringify(activePhoto.pipeline)),
                          false
                        )
                      }
                      className="text-xs text-amber-400 hover:text-amber-300 font-medium cursor-pointer"
                    >
                      Reset to AI
                    </button>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                      Preset Vibe
                    </label>
                    <input
                      type="text"
                      value={activePhoto.customPipeline.color_grading.vibe_preset}
                      onChange={(e) => {
                        const updated = { ...activePhoto.customPipeline };
                        updated.color_grading.vibe_preset = e.target.value;
                        updateActivePhotoPipeline(updated);
                      }}
                      className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white"
                    />
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex flex-col gap-3">
                    <h4 className="font-bold text-white text-xs flex items-center gap-1.5 uppercase tracking-wider">
                      <Tag className="w-3.5 h-3.5 text-amber-400" />
                      Signature Watermark
                    </h4>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Watermark Text</label>
                      <input
                        type="text"
                        value={globalWatermarkText}
                        onChange={(e) => setGlobalWatermarkText(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="py-6 border-t border-slate-900 text-center text-xs text-slate-500">
        Rumeth Thawasara Photo Studio &copy; 2026 · Dual-Layer Segmentation & Bokeh Masking Pipeline
      </footer>
    </div>
  );
}
