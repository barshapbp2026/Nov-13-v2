import React, { useState, useRef, useEffect } from 'react';
import {
  Database,
  FileSpreadsheet,
  Download,
  ExternalLink,
  BookOpen,
  Sparkles,
  LogIn,
  LogOut,
  Layers,
  ChevronDown,
  FileJson,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { FontSizeControls } from './FontSizeControls';

interface NavbarProps {
  totalRows: number;
  totalDocs: number;
  isAdminOrOwner?: boolean;
  onExportExcel: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onOpenPdfSummary?: () => void;
  onOpenMasterHub?: () => void;
  cachedCount?: number;
  currentUser?: User | null;
  onSignIn?: () => Promise<User | null>;
  onSignOut?: () => Promise<void>;
}

function toDevaCount(n: number): string {
  const digits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return String(n).replace(/[0-9]/g, d => digits[parseInt(d, 10)]);
}

export const Navbar: React.FC<NavbarProps> = ({
  totalRows,
  totalDocs,
  isAdminOrOwner = false,
  onExportExcel,
  onExportCsv,
  onExportJson,
  onOpenPdfSummary,
  onOpenMasterHub,
  cachedCount = 0,
  currentUser,
  onSignIn,
  onSignOut,
}) => {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between py-3 gap-3">
          {/* Brand & Clean Unboxed Metadata */}
          <div className="flex items-start justify-between gap-3 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-rose-700/90 border border-rose-500/40 flex items-center justify-center shrink-0">
                <BookOpen className="w-4.5 h-4.5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white truncate">
                  नेपाल कानून, संबिधान र मुलुकी संहिता पोर्टल
                </h1>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
                {isAdminOrOwner ? (
                  <>
                    <a
                      href="https://github.com/barshapbp2026/any-pdf-"
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-300 hover:text-white hover:underline inline-flex items-center gap-1 font-mono"
                    >
                      <Database className="w-3 h-3 text-slate-400" />
                      <span>barshapbp2026/any-pdf-</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                    <span aria-hidden="true">·</span>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1 text-slate-300">
                      <Database className="w-3 h-3 text-slate-400" />
                      <span>प्रमाणित कानूनी संग्रह</span>
                    </span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                <span className="tabular-nums">{toDevaCount(totalRows)} रेकर्ड</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{toDevaCount(totalDocs)} PDF</span>
              </div>
            </div>
            </div>
            <FontSizeControls variant="dark" className="lg:hidden mt-0.5" />
          </div>

          {/* Consolidated Action Bar */}
          <div className="flex items-center gap-2 flex-wrap">
            {isAdminOrOwner && onOpenMasterHub && (
              <button
                onClick={onOpenMasterHub}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors cursor-pointer"
                title="मास्टर सारांश स्टोर र ब्याच जेनरेटर"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>मास्टर स्टोर</span>
                {cachedCount > 0 && (
                  <span className="text-[11px] font-mono text-amber-100 tabular-nums">
                    ({toDevaCount(cachedCount)})
                  </span>
                )}
              </button>
            )}

            {onOpenPdfSummary && (
              <button
                onClick={onOpenPdfSummary}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                title="AI PDF सारांश"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI PDF सारांश</span>
              </button>
            )}

            {/* Single Clean Export Dropdown (Owner/Admin only) */}
            {isAdminOrOwner && (
              <div className="relative" ref={exportRef}>
                <button
                  type="button"
                  onClick={() => setExportMenuOpen(prev => !prev)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>निर्यात</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {exportMenuOpen && (
                  <div className="absolute right-0 mt-1.5 w-44 rounded-lg bg-white text-slate-800 shadow-xl border border-slate-200 py-1 z-50 text-xs">
                    <button
                      onClick={() => {
                        setExportMenuOpen(false);
                        onExportExcel();
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Excel (.xlsx)</span>
                    </button>
                    <button
                      onClick={() => {
                        setExportMenuOpen(false);
                        onExportCsv();
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-600" />
                      <span>CSV (UTF-8)</span>
                    </button>
                    <button
                      onClick={() => {
                        setExportMenuOpen(false);
                        onExportJson();
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
                    >
                      <FileJson className="w-3.5 h-3.5 text-slate-600" />
                      <span>JSON डेटा</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {onSignIn && !currentUser && (
              <button
                onClick={() => void onSignIn()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 transition-colors cursor-pointer"
                title="Google Sign-In"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign-In</span>
              </button>
            )}
            {currentUser && onSignOut && (
              <button
                onClick={() => void onSignOut()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                title={`Signed in as ${currentUser.email || 'User'} — Sign out`}
              >
                <span className="max-w-[120px] truncate text-emerald-300">
                  {currentUser.displayName || currentUser.email || 'Account'}
                </span>
                <LogOut className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}
            <FontSizeControls variant="dark" className="hidden lg:inline-flex" />
          </div>
        </div>
      </div>
    </header>
  );
};
