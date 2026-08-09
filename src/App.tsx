import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileType, CheckCircle, AlertCircle, ArrowDownToLine, Eye } from 'lucide-react';
import { processDrawioToDocx, decodeDrawioRaw } from './lib/converter';

declare global {
  interface Window {
    GraphViewer?: any;
  }
}

function DrawioViewer({ xml }: { xml: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    const renderGraph = () => {
      if (!window.GraphViewer) return false;
      
      containerRef.current!.innerHTML = '';
      const div = document.createElement('div');
      div.className = 'mxgraph';
      div.setAttribute('data-mxgraph', JSON.stringify({
        highlight: '#0000ff',
        nav: true,
        resize: true,
        xml: xml,
      }));
      div.style.width = '100%';
      div.style.height = '100%';
      div.style.minHeight = '400px';
      containerRef.current!.appendChild(div);
      
      window.GraphViewer.processElements();
      return true;
    };

    if (!renderGraph()) {
      const interval = setInterval(() => {
        if (renderGraph()) {
          clearInterval(interval);
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, [xml]);

  return <div ref={containerRef} className="w-full h-full min-h-[400px] bg-white overflow-auto p-2" />;
}

export default function App() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputMode, setInputMode] = useState<'paste' | 'preview'>('paste');
  const [pastedXml, setPastedXml] = useState('');
  const [previewXml, setPreviewXml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ name: string; blob: Blob; stats: { vertices: number; edges: number } } | null>(null);

  const resetState = () => {
    setPastedXml('');
    setPreviewXml(null);
    setError(null);
    setSuccessInfo(null);
    setInputMode('paste');
  };

  const handlePastePreview = () => {
    if (!pastedXml.trim()) {
      setError('Please paste valid draw.io XML content.');
      return;
    }
    setError(null);
    setSuccessInfo(null);
    setPreviewXml(pastedXml);
    setInputMode('preview');
  };

  const handleConvertToDocx = async () => {
    const targetXml = previewXml || pastedXml;
    if (!targetXml.trim()) return;
    setError(null);
    setIsProcessing(true);
    
    try {
      const buffer = new TextEncoder().encode(targetXml).buffer;
      const { blob, stats } = await processDrawioToDocx(buffer);
      setSuccessInfo({ name: 'converted_diagram.docx', blob, stats });
      if (!previewXml) setPreviewXml(targetXml);
    } catch (err) {
      console.error(err);
      setError('Failed to convert. Ensure it is a valid draw.io XML.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!successInfo) return;
    const url = URL.createObjectURL(successInfo.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = successInfo.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-800 flex flex-col font-sans antialiased selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-200">
            <FileType className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">DIAG_X</h1>
            <p className="text-xs text-slate-500">Diagram to DOCX Converter</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
            Ready
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Left Column - Input / Preview */}
        <section className="lg:col-span-8 flex flex-col space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-6 flex flex-col space-y-4 flex-grow">
            {/* Header & Mode Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 font-semibold text-xs">
                  01
                </span>
                <h2 className="text-base font-semibold text-slate-900">Source Diagram XML</h2>
              </div>

              <div className="flex items-center bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
                <button
                  onClick={() => setInputMode('paste')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    inputMode === 'paste'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Edit XML
                </button>
                <button
                  onClick={() => {
                    if (pastedXml.trim()) handlePastePreview();
                  }}
                  disabled={!previewXml && !pastedXml.trim()}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    inputMode === 'preview'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:hover:text-slate-600'
                  }`}
                >
                  Visual Preview
                </button>
              </div>
            </div>

            {/* Input Surface */}
            <div className="flex-grow min-h-[300px] sm:min-h-[420px] rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden flex flex-col focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
              {inputMode === 'paste' ? (
                <textarea
                  value={pastedXml}
                  onChange={(e) => setPastedXml(e.target.value)}
                  placeholder="Paste your draw.io XML content here..."
                  className="w-full h-full min-h-[300px] sm:min-h-[420px] p-4 bg-transparent font-mono text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none resize-none"
                  spellCheck={false}
                />
              ) : previewXml ? (
                <div className="w-full h-full min-h-[300px] sm:min-h-[420px] bg-white">
                  <DrawioViewer xml={previewXml} />
                </div>
              ) : (
                <div className="w-full h-full min-h-[300px] sm:min-h-[420px] flex flex-col items-center justify-center p-6 text-center text-slate-400">
                  <Eye className="w-10 h-10 mb-2 stroke-[1.5]" />
                  <p className="text-sm font-medium">No diagram loaded yet</p>
                  <p className="text-xs text-slate-400 mt-1">Paste your XML and click Preview</p>
                </div>
              )}
            </div>

            {/* Error Notification */}
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start space-x-3 animate-fadeIn">
                <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Conversion Error</p>
                  <p className="mt-0.5 text-rose-700">{error}</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right Column - Actions & Status */}
        <section className="lg:col-span-4 flex flex-col space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 sm:p-6 flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center space-x-2 pb-4 border-b border-slate-100 mb-5">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 font-semibold text-xs">
                  02
                </span>
                <h2 className="text-base font-semibold text-slate-900">Actions & Convert</h2>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handlePastePreview}
                  disabled={!pastedXml.trim() || isProcessing}
                  className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium text-sm flex items-center justify-between transition-all disabled:opacity-40 disabled:hover:bg-slate-50"
                >
                  <span className="flex items-center space-x-2.5">
                    <Eye className="w-4 h-4 text-indigo-600" />
                    <span>Preview Diagram</span>
                  </span>
                  <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase bg-white px-2 py-0.5 rounded border border-slate-200">
                    Step 1
                  </span>
                </button>

                <button
                  onClick={handleConvertToDocx}
                  disabled={(!pastedXml.trim() && !previewXml) || isProcessing}
                  className="w-full h-12 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-medium text-sm flex items-center justify-between shadow-sm shadow-indigo-200 transition-all disabled:opacity-40 disabled:hover:bg-indigo-600 disabled:shadow-none"
                >
                  <span className="flex items-center space-x-2.5">
                    <FileType className="w-4 h-4" />
                    <span>{isProcessing ? 'Converting...' : 'Convert to DOCX'}</span>
                  </span>
                  {isProcessing && (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  )}
                </button>

                {successInfo && (
                  <button
                    onClick={handleDownload}
                    className="w-full h-12 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium text-sm flex items-center justify-between shadow-sm shadow-emerald-200 transition-all"
                  >
                    <span className="flex items-center space-x-2.5">
                      <ArrowDownToLine className="w-4 h-4" />
                      <span>Download DOCX</span>
                    </span>
                    <CheckCircle className="w-4 h-4 text-emerald-200" />
                  </button>
                )}

                {(pastedXml || previewXml || successInfo) && (
                  <button
                    onClick={resetState}
                    className="w-full py-2 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors pt-2"
                  >
                    Reset Input & Clear All
                  </button>
                )}
              </div>
            </div>

            {/* Stats Card */}
            {successInfo && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Output Summary</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">
                    Success
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-800 truncate">{successInfo.name}</p>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-xs text-slate-600">
                  <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                    <span className="block text-slate-400 text-[10px] uppercase font-medium">Shapes</span>
                    <span className="text-sm font-semibold text-slate-800">{successInfo.stats.vertices}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                    <span className="block text-slate-400 text-[10px] uppercase font-medium">Connectors</span>
                    <span className="text-sm font-semibold text-slate-800">{successInfo.stats.edges}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
