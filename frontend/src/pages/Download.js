import React from 'react';
import { Radio, Download, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function DownloadPage() {
  const downloadUrl = `${BACKEND_URL}/api/download/project`;

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center px-6" data-testid="download-page">
      <div className="glass-card p-12 max-w-lg w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#00C2FF]/10 flex items-center justify-center mx-auto mb-8">
          <Radio className="w-8 h-8 text-[#00C2FF]" strokeWidth={2} />
        </div>

        <h1
          className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-white"
          style={{ fontFamily: 'Manrope' }}
        >
          Notify Project
        </h1>

        <p className="text-[#A1A1AA] mb-10 text-lg leading-relaxed">
          Download the full Notify project source code as a ZIP archive.
        </p>

        <a
          href={downloadUrl}
          className="btn-notify inline-flex items-center gap-3 text-lg px-10 py-4"
          data-testid="download-zip-btn"
          download
        >
          <Download className="w-5 h-5" />
          Download Notify Project (.zip)
        </a>

        <div className="mt-8">
          <Link
            to="/"
            className="text-sm text-[#52525B] hover:text-[#A1A1AA] transition-colors inline-flex items-center gap-2"
            data-testid="back-to-home-link"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Notify
          </Link>
        </div>
      </div>
    </div>
  );
}
