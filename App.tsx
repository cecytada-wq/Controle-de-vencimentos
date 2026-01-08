
import React, { useState, useEffect, useRef } from 'react';
import { Product } from './types';
import Dashboard from './components/Dashboard';
import ProductList from './components/ProductList';
import ProductForm from './components/ProductForm';
import SmartAdd from './components/SmartAdd';
import { parseExcelFile, exportToExcel, downloadTemplate, ImportResult } from './utils/excelParser';
import { 
  Plus, 
  LayoutDashboard, 
  ClipboardList, 
  Scan, 
  CalendarClock,
  FileUp,
  Loader2,
  ArrowDownToLine,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  X,
  Eye
} from 'lucide-react';

const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'INVENTORY'>('DASHBOARD');
  const [importSummary, setImportSummary] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<{message: string, diagnostics: any} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const STORAGE_KEY = 'controle_vencimentos_products_v2';

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setProducts(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  }, [products]);

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportSummary(null);
    setImportError(null);

    try {
      const result = await parseExcelFile(file);
      const newProducts: Product[] = result.products.map(item => ({
        ...item,
        id: crypto.randomUUID(),
        createdAt: Date.now()
      }));
      
      setProducts(prev => [...prev, ...newProducts]);
      setImportSummary(result);
      if (newProducts.length > 0) setActiveTab('INVENTORY');
    } catch (err: any) {
      setImportError(err);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen pb-24 md:pb-0 md:pl-64 bg-slate-50">
      <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls, .csv" onChange={handleImportExcel} />

      {/* MODAL DE DIAGNÓSTICO */}
      {(importSummary || importError) && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className={`px-8 py-6 flex items-center justify-between border-b ${importError ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
              <div className="flex items-center gap-3">
                {importError ? <AlertTriangle className="text-rose-600 w-6 h-6" /> : <CheckCircle2 className="text-emerald-600 w-6 h-6" />}
                <h2 className={`text-xl font-black ${importError ? 'text-rose-800' : 'text-emerald-800'}`}>
                  {importError ? 'Erro na Planilha' : 'Sucesso!'}
                </h2>
              </div>
              <button onClick={() => { setImportSummary(null); setImportError(null); }} className="p-2 hover:bg-black/5 rounded-full"><X className="w-6 h-6 text-slate-400" /></button>
            </div>
            
            <div className="p-8 max-h-[70vh] overflow-y-auto space-y-6 no-scrollbar">
              {importError ? (
                <div className="space-y-6">
                  <div className="bg-rose-50 border border-rose-100 p-5 rounded-3xl">
                    <p className="text-rose-800 font-bold mb-2">O que aconteceu:</p>
                    <p className="text-rose-600 text-sm leading-relaxed whitespace-pre-line">{importError.message}</p>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Eye className="w-3 h-3" /> Como o sistema viu sua planilha (Top 3 linhas):
                    </p>
                    <div className="bg-slate-900 text-indigo-300 p-4 rounded-2xl text-[10px] font-mono overflow-x-auto">
                      <pre>{JSON.stringify(importError.diagnostics.rawPreview, null, 2)}</pre>
                    </div>
                    <p className="text-[10px] text-slate-400 italic">Dica: Se as chaves acima (ex: "__EMPTY") não forem os nomes das suas colunas, sua planilha pode ter linhas vazias no topo.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="flex-1 bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                      <p className="text-[10px] font-black text-emerald-600 uppercase mb-1">Importados</p>
                      <p className="text-3xl font-black text-emerald-800">{importSummary?.diagnostics.successCount}</p>
                    </div>
                    <div className="flex-1 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Linhas Lidas</p>
                      <p className="text-3xl font-black text-slate-800">{importSummary?.diagnostics.totalRowsFound}</p>
                    </div>
                  </div>
                  
                  {importSummary?.diagnostics.skippedRows.length! > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-amber-600">Itens ignorados por erro de data ou nome:</p>
                      <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 text-xs text-amber-800 space-y-1">
                        {importSummary?.diagnostics.skippedRows.map((r, i) => (
                          <div key={i}>• Linha {r.row}: {r.reason}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-8 pt-0">
              <button onClick={() => { setImportSummary(null); setImportError(null); }} className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-200 hidden md:flex flex-col p-6 z-40">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg"><CalendarClock className="text-white w-6 h-6" /></div>
          <span className="text-lg font-bold text-slate-800 tracking-tight">Estoque Pro</span>
        </div>
        <nav className="space-y-1 flex-1">
          <NavButton active={activeTab === 'DASHBOARD'} onClick={() => setActiveTab('DASHBOARD')} icon={<LayoutDashboard className="w-5 h-5" />}>Painel</NavButton>
          <NavButton active={activeTab === 'INVENTORY'} onClick={() => setActiveTab('INVENTORY')} icon={<ClipboardList className="w-5 h-5" />}>Inventário</NavButton>
          <div className="pt-8 pb-4">
            <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Planilhas</p>
            <NavButton active={false} onClick={() => fileInputRef.current?.click()} icon={isImporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileUp className="w-5 h-5" />}>Importar Excel</NavButton>
            <NavButton active={false} onClick={downloadTemplate} icon={<FileSpreadsheet className="w-5 h-5" />}>Baixar Modelo</NavButton>
            <NavButton active={false} onClick={() => exportToExcel(products)} icon={<ArrowDownToLine className="w-5 h-5" />}>Exportar Backup</NavButton>
          </div>
        </nav>
        <button onClick={() => setIsScannerOpen(true)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl flex items-center justify-center gap-3 font-bold shadow-xl shadow-indigo-100">
          <Scan className="w-5 h-5" /> Scanner AI
        </button>
      </aside>

      <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 z-30 px-6 py-4 flex items-center justify-between md:justify-end">
        <div className="md:hidden flex items-center gap-2">
          <CalendarClock className="text-indigo-600 w-8 h-8" />
          <span className="text-lg font-bold text-slate-800">Estoque</span>
        </div>
        <button onClick={() => { setEditingProduct(null); setIsFormOpen(true); }} className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 active:scale-95 transition-transform"><Plus className="w-6 h-6" /></button>
      </header>

      <main className="p-6 max-w-5xl mx-auto">
        {activeTab === 'DASHBOARD' ? <Dashboard products={products} /> : <ProductList products={products} onDelete={id => setProducts(p => p.filter(x => x.id !== id))} onEdit={p => { setEditingProduct(p); setIsFormOpen(true); }} onAddManual={() => setIsFormOpen(true)} />}
      </main>

      {/* MOBILE NAV */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex items-center justify-around py-4 md:hidden z-40 shadow-lg">
        <MobileNavButton active={activeTab === 'DASHBOARD'} onClick={() => setActiveTab('DASHBOARD')} icon={<LayoutDashboard className="w-6 h-6" />} label="Home" />
        <button onClick={() => setIsScannerOpen(true)} className="w-16 h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-2xl -mt-12 border-4 border-slate-50 active:scale-90 transition-transform"><Scan className="w-8 h-8" /></button>
        <MobileNavButton active={activeTab === 'INVENTORY'} onClick={() => setActiveTab('INVENTORY')} icon={<ClipboardList className="w-6 h-6" />} label="Itens" />
      </nav>

      {isFormOpen && <ProductForm onClose={() => { setIsFormOpen(false); setEditingProduct(null); }} onSubmit={data => {
        if (editingProduct) setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, ...data } : p));
        else setProducts(prev => [...prev, { ...data, id: crypto.randomUUID(), createdAt: Date.now() }]);
        setIsFormOpen(false); setEditingProduct(null);
      }} initialData={editingProduct} />}
      
      {isScannerOpen && <SmartAdd onClose={() => setIsScannerOpen(false)} onScanComplete={data => {
        setProducts(prev => [...prev, { ...data, id: crypto.randomUUID(), quantity: 1, createdAt: Date.now() }]);
        setIsScannerOpen(false); setActiveTab('INVENTORY');
      }} />}
    </div>
  );
};

const NavButton = ({ active, children, onClick, icon }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}>{icon} {children}</button>
);

const MobileNavButton = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 ${active ? 'text-indigo-600' : 'text-slate-400'}`}>{icon} <span className="text-[10px] font-black uppercase tracking-widest">{label}</span></button>
);

export default App;
