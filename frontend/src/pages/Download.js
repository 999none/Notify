import React, { useState } from 'react';
import { Download, Package, FileArchive, CheckCircle, Loader2 } from 'lucide-react';
import AppLayout from '../components/AppLayout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function DownloadPage() {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    setDownloaded(false);
    try {
      const token = localStorage.getItem('notify_token');
      const response = await fetch(`${BACKEND_URL}/api/download/project`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Notify.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setDownloaded(true);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen flex items-center justify-center p-6" data-testid="download-page">
        <div className="max-w-md w-full">
          <div className="glass-card p-10 text-center animate-fade-in-up">
            <div className="w-20 h-20 rounded-2xl bg-[#4DA6FF]/10 flex items-center justify-center mx-auto mb-8 animate-pulse-glow">
              <Package className="w-10 h-10 text-[#4DA6FF]" strokeWidth={1.8} />
            </div>

            <h1
              className="text-3xl font-bold tracking-tight mb-3 text-white"
              style={{ fontFamily: 'Syne' }}
              data-testid="download-title"
            >
              Download Project
            </h1>

            <p className="text-[#94A3B8] mb-8 leading-relaxed">
              Telecharge le projet complet Notify en un clic. L'archive ZIP contient tout le code source, backend et frontend.
            </p>

            <div className="glass p-4 rounded-2xl mb-8 flex items-center gap-4 text-left">
              <FileArchive className="w-8 h-8 text-[#4DA6FF] flex-shrink-0" strokeWidth={1.5} />
              <div>
                <p className="text-sm font-semibold text-white">Notify.zip</p>
                <p className="text-xs text-[#475569]">Projet complet (backend + frontend + config)</p>
              </div>
            </div>

            <button
              onClick={handleDownload}
              disabled={downloading}
              className="btn-notify w-full inline-flex items-center justify-center gap-3 text-base py-4 disabled:opacity-60 disabled:cursor-not-allowed"
              data-testid="download-zip-btn"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generation du ZIP...
                </>
              ) : downloaded ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Telecharge avec succes !
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Telecharger le ZIP
                </>
              )}
            </button>

            {downloaded && (
              <p className="mt-4 text-xs text-[#4DA6FF] animate-fade-in" data-testid="download-success-msg">
                Le fichier a ete telecharge dans ton dossier de telechargements.
              </p>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
