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
  AlertCircle,
  UserCheck,
  Sun,
  Palette
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
  detected_subject: 'General Photograph',
  has_faces: false,
  current_color_cast: 'none',
  lighting_condition: 'balanced daylight',
};

const DEFAULT_PIPELINE: EditingPipeline = {
  white_balance: {
    temperature_adjustment: 10,
    tint_adjustment: 0,
    auto_neutralize: true,
  },
  color_grading: {
    vibe_preset: 'cinematic warm',
    exposure: 10,
    contrast: 15,
    saturation: 10,
    vibrancy: 15,
  },
  retouch_and_enhancement: {
    face_restoration: {
      enabled: false,
      sharpness_boost: 20,
    },
    subject_enhancement: {
      local_contrast: 25,
      edge_sharpening: 15,
    },
    background_blur: {
      enabled: false,
      blur_intensity: 0,
    },
  },
  branding_overlay: {
    add_footer: true,
    tag_style: 'clean minimalist / professional badge',
    position: 'bottom-center',
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

  const [globalWatermarkText, setGlobalWatermarkText] = useState('© 2026 Lumina Studio • Shot on AI');

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

  // Canvas processing pipeline based on the exact user schema parameters
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

      const { white_balance, color_grading, retouch_and_enhancement } = pipeline;

      const expFactor = 1 + color_grading.exposure / 100;
      const contrastFactor = Math.pow((color_grading.contrast + 100) / 100, 2);
      const satFactor = (color_grading.saturation + 100) / 100;
      const vibrancyFactor = (color_grading.vibrancy + 100) / 100;

      const tempVal = white_balance.temperature_adjustment / 100;
      const tintVal = white_balance.tint_adjustment / 100;
      const localContrast = retouch_and_enhancement.subject_enhancement.local_contrast / 100;

      for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        // Exposure
        r *= expFactor;
        g *= expFactor;
        b *= expFactor;

        // Contrast
        r = ((r / 255 - 0.5) * contrastFactor + 0.5) * 255;
        g = ((g / 255 - 0.5) * contrastFactor + 0.5) * 255;
        b = ((b / 255 - 0.5) * contrastFactor + 0.5) * 255;

        // White Balance (Temperature & Tint)
        if (tempVal > 0) {
          r += tempVal * 35;
          b -= tempVal * 35;
        } else {
          b += Math.abs(tempVal) * 35;
          r -= Math.abs(tempVal) * 35;
        }
        if (tintVal > 0) {
          g -= tintVal * 20;
          r += tintVal * 20;
        } else {
          g += Math.abs(tintVal) * 20;
        }

        // Saturation & Vibrancy
        if (satFactor !== 1 || vibrancyFactor !== 1) {
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          const totalSat = satFactor * vibrancyFactor;
          r = gray + totalSat * (r - gray);
          g = gray + totalSat * (g - gray);
          b = gray + totalSat * (b - gray);
        }

        // Local Contrast / Clarity adjustment
        if (localContrast !== 0) {
          const diff = (r - 128) * localContrast * 0.2;
          r += diff;
          g += diff;
          b += diff;
        }

        data[i] = Math.min(255, Math.max(0, r));
        data[i + 1] = Math.min(255, Math.max(0, g));
        data[i + 2] = Math.min(255, Math.max(0, b));
      }

      ctx.putImageData(imgData, 0, 0);

      // Branding Overlay Footer Tag
      const branding = pipeline.branding_overlay;
      if (branding.add_footer && wmText) {
        ctx.save();
        const fontSize = Math.max(14, Math.round((canvas.width / 1100) * 22));
        ctx.font = `600 ${fontSize}px system-ui, sans-serif`;

        const metrics = ctx.measureText(wmText);
        const padding = fontSize * 1.4;
        let x = padding;
        let y = canvas.height - padding;

        if (branding.position === 'bottom-right') {
          x = canvas.width - metrics.width - padding;
        } else if (branding.position === 'bottom-center') {
          x = (canvas.width - metrics.width) / 2;
        }

        // Background professional badge
        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        const bgPad = fontSize * 0.7;
        ctx.beginPath();
        ctx.roundRect(
          x - bgPad,
          y - fontSize - bgPad * 0.5,
          metrics.width + bgPad * 2,
          fontSize + bgPad * 1.3,
          10
        );
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 4;
        ctx.fillText(wmText, x, y);
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
    a.download = `lumina_graded_${photo.name}`;
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
      const folder = zip.folder('lumina_graded_folder');

      for (const p of gradedPhotos) {
        if (!p.processedUrl) continue;
        const response = await fetch(p.processedUrl);
        const blob = await response.blob();
        folder?.file(`graded_${p.name}`, blob);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lumina_ai_batch_export_${Date.now()}.zip`;
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

      {/* Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white">Lumina AI</span>
            <span className="text-xs text-indigo-400 font-medium ml-2 hidden sm:inline">Schema-Driven Studio</span>
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
          <span className="text-xs text-slate-500">Structured Editing Pipeline Schema</span>
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
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/25 whitespace-nowrap shrink-0 cursor-pointer"
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
            <div className="w-24 h-24 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-6 shadow-2xl shadow-indigo-500/10 animate-pulse">
              <Camera className="w-12 h-12 text-indigo-400" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-3">
              Schema-Driven AI Photo Pipeline Studio
            </h1>
            <p className="text-slate-400 max-w-xl text-sm mb-8 leading-relaxed">
              Upload a folder of photos. Gemini AI inspects the subject, faces, lighting conditions, and color cast, executing an automated editing pipeline with white balance, color grading, retouching, and branding overlays.
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
                className="px-6 py-3 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-500 transition-all flex items-center gap-2.5 shadow-xl shadow-indigo-600/30 cursor-pointer"
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
                    {photos.filter((p) => p.status === 'graded').length} Pipeline Graded
                  </span>
                </div>
                <div className="h-4 w-px bg-slate-800 hidden sm:block" />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-indigo-600 text-white'
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
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Pipeline Studio
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleBatchProcess}
                  disabled={isBatchProcessing}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  {isBatchProcessing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {isBatchProcessing
                    ? `Running Pipeline (${batchProgress.current}/${batchProgress.total})`
                    : 'Run AI Pipeline on All'}
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
                          <span className="text-indigo-400 flex items-center gap-1 animate-pulse">
                            <RefreshCw className="w-3 h-3 animate-spin" /> AI Analyzing
                          </span>
                        )}
                        {photo.status === 'graded' && (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Processed
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
                          <span className="text-indigo-300 font-medium">Subject:</span>{' '}
                          {photo.analysis.detected_subject || 'Analyzing...'}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                        {photo.status !== 'graded' ? (
                          <button
                            onClick={() => analyzePhoto(photo.id)}
                            disabled={photo.status === 'analyzing'}
                            className="px-3 py-1.5 text-xs font-semibold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            {photo.status === 'analyzing' ? 'Running...' : 'Run Pipeline'}
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
                            Edit Pipeline
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

            {/* Studio Suite View */}
            {viewMode === 'studio' && activePhoto && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
                {/* Left Preview */}
                <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-white text-base">{activePhoto.name}</h3>
                      <p className="text-xs text-indigo-400 font-medium">
                        Preset: {activePhoto.pipeline.color_grading.vibe_preset}
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
                      {compareBefore ? 'ORIGINAL' : 'PIPELINE GRADED + BADGE'}
                    </div>
                  </div>

                  {/* Schema Analysis Card */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <span className="text-[11px] text-slate-500 block uppercase">Subject</span>
                      <span className="text-xs font-medium text-slate-200">
                        {activePhoto.analysis.detected_subject}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block uppercase">Faces Detected</span>
                      <span className="text-xs font-medium text-indigo-400">
                        {activePhoto.analysis.has_faces ? 'Yes (Face Restoration Ready)' : 'None'}
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

                {/* Right Schema Parameters Editor */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col gap-6 shadow-2xl overflow-y-auto max-h-[850px]">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-indigo-400" />
                      Editing Pipeline Parameters
                    </h3>
                    <button
                      onClick={() =>
                        updateActivePhotoPipeline(
                          JSON.parse(JSON.stringify(activePhoto.pipeline)),
                          false
                        )
                      }
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                    >
                      Reset to AI
                    </button>
                  </div>

                  {/* Vibe Preset */}
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

                  {/* White Balance */}
                  <div className="flex flex-col gap-3 pt-3 border-t border-slate-800">
                    <h4 className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
                      White Balance
                    </h4>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300">Temperature</span>
                        <span className="font-mono text-indigo-400">
                          {activePhoto.customPipeline.white_balance.temperature_adjustment}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={-100}
                        max={100}
                        value={activePhoto.customPipeline.white_balance.temperature_adjustment}
                        onChange={(e) => {
                          const updated = { ...activePhoto.customPipeline };
                          updated.white_balance.temperature_adjustment = Number(e.target.value);
                          updateActivePhotoPipeline(updated);
                        }}
                        className="w-full accent-indigo-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300">Tint</span>
                        <span className="font-mono text-indigo-400">
                          {activePhoto.customPipeline.white_balance.tint_adjustment}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={-100}
                        max={100}
                        value={activePhoto.customPipeline.white_balance.tint_adjustment}
                        onChange={(e) => {
                          const updated = { ...activePhoto.customPipeline };
                          updated.white_balance.tint_adjustment = Number(e.target.value);
                          updateActivePhotoPipeline(updated);
                        }}
                        className="w-full accent-indigo-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Color Grading */}
                  <div className="flex flex-col gap-3 pt-3 border-t border-slate-800">
                    <h4 className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
                      Color Grading
                    </h4>
                    {(
                      [
                        { key: 'exposure', label: 'Exposure' },
                        { key: 'contrast', label: 'Contrast' },
                        { key: 'saturation', label: 'Saturation' },
                        { key: 'vibrancy', label: 'Vibrancy' },
                      ] as const
                    ).map(({ key, label }) => (
                      <div key={key} className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-300">{label}</span>
                          <span className="font-mono text-indigo-400">
                            {activePhoto.customPipeline.color_grading[key]}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={-100}
                          max={100}
                          value={activePhoto.customPipeline.color_grading[key]}
                          onChange={(e) => {
                            const updated = { ...activePhoto.customPipeline };
                            updated.color_grading[key] = Number(e.target.value);
                            updateActivePhotoPipeline(updated);
                          }}
                          className="w-full accent-indigo-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Retouch & Enhancement */}
                  <div className="flex flex-col gap-3 pt-3 border-t border-slate-800">
                    <h4 className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
                      Subject Enhancement
                    </h4>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300">Local Contrast</span>
                        <span className="font-mono text-indigo-400">
                          {activePhoto.customPipeline.retouch_and_enhancement.subject_enhancement.local_contrast}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={-100}
                        max={100}
                        value={activePhoto.customPipeline.retouch_and_enhancement.subject_enhancement.local_contrast}
                        onChange={(e) => {
                          const updated = { ...activePhoto.customPipeline };
                          updated.retouch_and_enhancement.subject_enhancement.local_contrast = Number(e.target.value);
                          updateActivePhotoPipeline(updated);
                        }}
                        className="w-full accent-indigo-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Branding Overlay */}
                  <div className="pt-3 border-t border-slate-800 flex flex-col gap-3">
                    <h4 className="font-bold text-white text-xs flex items-center gap-1.5 uppercase tracking-wider">
                      <Tag className="w-3.5 h-3.5 text-indigo-400" />
                      Branding Overlay
                    </h4>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Global Footer Tag</label>
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
        Lumina AI Studio &copy; 2026 · Schema-Driven Pipeline & HTML5 Canvas
      </footer>
    </div>
  );
}
