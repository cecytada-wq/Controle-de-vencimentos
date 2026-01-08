
import React, { useState, useEffect, useRef } from 'react';
import { Product } from './types';
import Dashboard from './components/Dashboard';
import ProductList from './components/ProductList';
import ProductForm from './components/ProductForm';
import SmartAdd from './components/SmartAdd';
import { generateId } from './utils/helpers';
import { parseExcelFile, exportToExcel, ImportResult } from './utils/excelParser';
import { 
  Plus, 
  LayoutDashboard, 
  ClipboardList, 
  Scan, 
  CalendarClock,
  FileUp,
  Loader2,
  ArrowDownToLine,
  AlertOctagon,
  CheckCircle2,
  X,
  Bug
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
  const STORAGE_KEY = 'vencimentos_v4_storage';

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
        id: generateId(),
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
    <div className="min-h-screen pb-24 md:pb-0 md:pl-64 bg-slate-50 text-slate-900">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept=".csv, .xlsx, .xls" 
        onChange={handleImportExcel} 
      />

      {/* Modal de Feedback de Importação */}
      {(importSummary || importError) && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden">
            <div className={`px-8 py-6 flex items-center justify-between ${importError ? 'bg-rose-500' : 'bg-emerald-500'}`}>
              <div className="flex items-center gap-3 text-white">
                {importError ? <AlertOctagon className="w-8 h-8" /> : <CheckCircle2 className="w-8 h-8" />}
                <div>
                  <h2 className="text-xl font-black">
                    {importError ? 'Erro na Importação' : 'Sucesso!'}
                  </h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                    Processamento de Arquivo
                  </p>
                </div>
              </div>
              <button 
                onClick={() => { setImportSummary(null); setImportError(null); }}
                className="p-2 bg-black/10 rounded-full hover:bg-black/20 text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              {importError ? (
                <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-xl">
                  <p className="text-rose-900 font-bold mb-1">Não conseguimos ler seu arquivo:</p>
                  <p className="text-rose-700 text-sm">{importError.message}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-6 rounded-3xl text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Importados</p>
                    <p className="text-4xl font-black text-emerald-600">{importSummary?.diagnostics.successCount}</p>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-3xl text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total de Linhas</p>
                    <p className="text-4xl font-black text-slate-800">{importSummary?.diagnostics.totalRowsFound}</p>
                  </div>
                </div>
              )}
              
              <button 
                onClick={() => { setImportSummary(null); setImportError(null); }}
                className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all active:scale-95 shadow-xl"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Desktop */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-200 hidden md:flex flex-col p-6 z-40">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <CalendarClock className="text-white w-6 h-6" />
          </div>
          <span className="text-lg font-black text-slate-800 tracking-tight">EstoquePró</span>
        </div>
        
        <nav className="space-y-1 flex-1">
          <NavButton active={activeTab === 'DASHBOARD'} onClick={() => setActiveTab('DASHBOARD')} icon={<LayoutDashboard className="w-5 h-5" />}>Dashboard</NavButton>
          <NavButton active={activeTab === 'INVENTORY'} onClick={() => setActiveTab('INVENTORY')} icon={<ClipboardList className="w-5 h-5" />}>Inventário</NavButton>
          
          <div className="pt-8 pb-4">
            <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Arquivos</p>
            <NavButton active={false} onClick={() => fileInputRef.current?.click()} icon={isImporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileUp className="w-5 h-5" />}>Importar CSV / Excel</NavButton>
            <NavButton active={false} onClick={() => exportToExcel(products)} icon={<ArrowDownToLine className="w-5 h-5" />}>Exportar Backup</NavButton>
          </div>
        </nav>

        <button 
          onClick={() => setIsScannerOpen(true)}
          className="w-full py-4 bg-indigo-600 text-white rounded-2xl flex items-center justify-center gap-3 font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-colors"
        >
          <Scan className="w-5 h-5" /> Scanner AI
        </button>
      </aside>

      {/* Header Mobile/Global */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 z-30 px-6 py-4 flex items-center justify-between md:justify-end">
        <div className="md:hidden flex items-center gap-2">
          <CalendarClock className="text-indigo-600 w-8 h-8" />
          <span className="text-xl font-black text-slate-800">Estoque</span>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 md:hidden"
            title="Importar CSV"
          >
            <FileUp className="w-6 h-6" />
          </button>
          <button 
            onClick={() => { setEditingProduct(null); setIsFormOpen(true); }} 
            className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 active:scale-95 transition-all"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="p-6 max-w-5xl mx-auto">
        {activeTab === 'DASHBOARD' ? (
          <Dashboard products={products} />
        ) : (
          <ProductList 
            products={products} 
            onDelete={id => setProducts(p => p.filter(x => x.id !== id))} 
            onEdit={p => { setEditingProduct(p); setIsFormOpen(true); }} 
            onAddManual={() => setIsFormOpen(true)} 
          />
        )}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex items-center justify-around py-4 md:hidden z-40 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
        <MobileNavButton active={activeTab === 'DASHBOARD'} onClick={() => setActiveTab('DASHBOARD')} icon={<LayoutDashboard className="w-6 h-6" />} label="Home" />
        <button 
          onClick={() => setIsScannerOpen(true)} 
          className="w-16 h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-2xl -mt-12 border-4 border-slate-50 active:scale-90 transition-all hover:bg-indigo-700"
        >
          <Scan className="w-8 h-8" />
        </button>
        <MobileNavButton active={activeTab === 'INVENTORY'} onClick={() => setActiveTab('INVENTORY')} icon={<ClipboardList className="w-6 h-6" />} label="Itens" />
      </nav>

      {/* Modais */}
      {isFormOpen && (
        <ProductForm 
          onClose={() => { setIsFormOpen(false); setEditingProduct(null); }} 
          onSubmit={data => {
            if (editingProduct) setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, ...data } : p));
            else setProducts(prev => [...prev, { ...data, id: generateId(), createdAt: Date.now() }]);
            setIsFormOpen(false); 
            setEditingProduct(null);
          }} 
          initialData={editingProduct} 
        />
      )}
      
      {isScannerOpen && (
        <SmartAdd 
          onClose={() => setIsScannerOpen(false)} 
          onScanComplete={data => {
            setProducts(prev => [...prev, { ...data, id: generateId(), quantity: 1, createdAt: Date.now() }]);
            setIsScannerOpen(false); 
            setActiveTab('INVENTORY');
          }} 
        />
      )}
    </div>
  );
};

const NavButton = ({ active, children, onClick, icon }: any) => (
  <button 
    onClick={onClick} 
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${
      active ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'
    }`}
  >
    {icon} {children}
  </button>
);

const MobileNavButton = ({ active, onClick, icon, label }: any) => (
  <button 
    onClick={onClick} 
    className={`flex flex-col items-center gap-1 transition-colors ${
      active ? 'text-indigo-600' : 'text-slate-400'
    }`}
  >
    {icon} 
    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

export default App;
