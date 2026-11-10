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
  detected_subject: 'General Portrait / Landscape',
  has_faces: false,
  current_color_cast: 'none',
  lighting_condition: 'natural daylight',
};

const DEFAULT_PIPELINE: EditingPipeline = {
  white_balance: {
    temperature_adjustment: 5,
    tint_adjustment: 0,
    auto_neutralize: true,
  },
  color_grading: {
    vibe_preset: 'Cinematic Natural Portrait',
    exposure: 5,
    contrast: 10,
    saturation: 0,
    vibrancy: 10,
  },
  retouch_and_enhancement: {
    face_restoration: {
      enabled: true,
      sharpness_boost: 10,
    },
    subject_enhancement: {
      local_contrast: 15,
      edge_sharpening: 10,
    },
    background_blur: {
      enabled: false,
      blur_intensity: 0,
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

  // Professional Color Grading Engine with Strict Skin Tone Protection & Olive/Emerald Foliage Shift
  const renderProcessedImage = (
    imgElement: HTMLImageElement,
    pipeline: EditingPipeline,
    wmText: string
  ): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(imgElement.src);
        return;
      }

      canvas.width = imgElement.naturalWidth || imgElement.width || 1200;
      canvas.height = imgElement.naturalHeight || imgElement.height || 800;

      ctx.drawImage(imgElement, 0, 0);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

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

      for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        // 1. Natural Golden-Hour White Balance Shift (+350K)
        r += 8;
        b -= 6;

        // 2. Convert to HSL
        let [h, s, l] = rgbToHsl(r, g, b);

        // 3. Strict Human Skin Tone Protection & Isolation (Hues 10° to 45°)
        const isSkinTone = h >= 10 && h <= 45 && s > 0.1 && s < 0.75 && l > 0.25 && l < 0.92;
        if (isSkinTone) {
          // Preserve soft golden natural skin tones without harsh saturation or contrast distortion
          s = Math.min(0.52, s * 1.02);
        } else {
          // 4. Foliage & Background Grading: desaturate and shift greens (70° - 165°) toward deep, muted cinematic olive/emerald
          if (h >= 70 && h <= 165) {
            h = h * 0.35 + 140 * 0.65; // Shift toward olive/emerald
            s *= 0.52; // Strong desaturation of neon/radioactive greens
            l *= 0.92; // Deepen slightly for rich cinematic foliage
          }
        }

        let [nr, ng, nb] = hslToRgb(h, s, l);
        r = nr; g = ng; b = nb;

        // 5. Professional Tone Curves: Matte shadow lift & smooth highlight rolloff (zero crushed blacks)
        const normalize = (v: number) => v / 255;
        const denormalize = (v: number) => Math.min(255, Math.max(0, v * 255));

        let fnR = normalize(r);
        let fnG = normalize(g);
        let fnB = normalize(b);

        const applySmoothCurves = (x: number) => {
          // Soft matte shadow lift (black floor 0.1)
          const lifted = x * 0.9 + 0.1;
          // Smooth S-curve with zero clipping
          return lifted < 0.5 
            ? 2 * lifted * lifted 
            : 1 - Math.pow(-2 * lifted + 2, 2) / 2;
        };

        fnR = applySmoothCurves(fnR);
        fnG = applySmoothCurves(fnG);
        fnB = applySmoothCurves(fnB);

        r = denormalize(fnR);
        g = denormalize(fnG);
        b = denormalize(fnB);

        // 6. Subtle Split-Toning (Cool shadows, warm highlights)
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        const shadowWeight = 1 - luma / 255;
        const highlightWeight = luma / 255;

        r -= shadowWeight * 2;
        g -= shadowWeight * 1;
        b += shadowWeight * 5;

        r += highlightWeight * 5;
        g += highlightWeight * 2;
        b -= highlightWeight * 2;

        data[i] = Math.min(255, Math.max(0, r));
        data[i + 1] = Math.min(255, Math.max(0, g));
        data[i + 2] = Math.min(255, Math.max(0, b));
      }

      ctx.putImageData(imgData, 0, 0);

      // Function to apply Rumeth Thawasara branding watermark to every photo in the batch queue
      const applyCustomBranding = (
        cnv: HTMLCanvasElement,
        context: CanvasRenderingContext2D,
        customText = "Rumeth Thawasara"
      ) => {
        const width = cnv.width;
        const height = cnv.height;

        const fontSize = Math.max(16, Math.floor(width * 0.022));
        context.font = `500 ${fontSize}px sans-serif`;
        context.fillStyle = "rgba(255, 255, 255, 0.85)";
        context.shadowColor = "rgba(0, 0, 0, 0.6)";
        context.shadowBlur = 6;
        context.textAlign = "right";

        const paddingX = width * 0.03;
        const paddingY = height * 0.03;
        
        context.fillText(customText, width - paddingX, height - paddingY);
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
            <span className="text-xs text-amber-400 font-medium ml-2 hidden sm:inline">Photo Studio</span>
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
          <span className="text-xs text-slate-500">Professional Skin Tone & Foliage Grading Suite</span>
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
              Rumeth Thawasara Professional Photo Studio
            </h1>
            <p className="text-slate-400 max-w-xl text-sm mb-8 leading-relaxed">
              Upload a folder or set of photos. AI analyzes subjects, lighting, and skin tones, applying a professional DaVinci Resolve style grading pipeline with strict skin tone protection, olive/emerald foliage grading, matte film curves, and signature branding.
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
                    {photos.filter((p) => p.status === 'graded').length} Graded by Rumeth Thawasara
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
                    : 'Grade All Photos'}
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
                            <RefreshCw className="w-3 h-3 animate-spin" /> Analyzing
                          </span>
                        )}
                        {photo.status === 'graded' && (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Graded
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
                            {photo.status === 'analyzing' ? 'Grading...' : 'Grade Photo'}
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
                              title="Download Graded Photo"
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

            {/* Studio Suite View */}
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
                      <span className="text-xs font-medium text-amber-400">
                        {activePhoto.analysis.has_faces ? 'Protected & Soft' : 'Balanced'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block uppercase">Color Cast</span>
                      <span className="text-xs font-medium text-slate-200">
                        {activePhoto.analysis.current_color_cast}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block uppercase">Lighting</span>
                      <span className="text-xs font-medium text-slate-200">
                        {activePhoto.analysis.lighting_condition}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col gap-6 shadow-2xl overflow-y-auto max-h-[850px]">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-amber-400" />
                      Studio Grade Controls
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
                      Vibe Preset
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

                  <div className="flex flex-col gap-3 pt-3 border-t border-slate-800">
                    <h4 className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
                      White Balance & Exposure
                    </h4>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300">Exposure</span>
                        <span className="font-mono text-amber-400">
                          {activePhoto.customPipeline.color_grading.exposure}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={-50}
                        max={50}
                        value={activePhoto.customPipeline.color_grading.exposure}
                        onChange={(e) => {
                          const updated = { ...activePhoto.customPipeline };
                          updated.color_grading.exposure = Number(e.target.value);
                          updateActivePhotoPipeline(updated);
                        }}
                        className="w-full accent-amber-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
                      />
                    </div>
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
        Rumeth Thawasara Photo Studio &copy; 2026 · Professional Skin Tone & Foliage Color Grading
      </footer>
    </div>
  );
}
