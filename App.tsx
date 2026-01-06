
import React, { useState, useEffect, useRef } from 'react';
import { Product } from './types';
import Dashboard from './components/Dashboard';
import ProductList from './components/ProductList';
import ProductForm from './components/ProductForm';
import SmartAdd from './components/SmartAdd';
import { parseExcelFile, exportToExcel } from './utils/excelParser';
import { 
  Plus, 
  LayoutDashboard, 
  ClipboardList, 
  Scan, 
  Settings,
  CalendarClock,
  PackagePlus,
  FileDown,
  FileUp,
  Bell,
  Loader2,
  ArrowDownToLine
} from 'lucide-react';

const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'INVENTORY'>('DASHBOARD');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const STORAGE_KEY = 'controle_vencimentos_products';

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setProducts(JSON.parse(saved));
    } else {
      const mock: Product[] = [
        { id: '1', name: 'Leite Semi-Desnatado', category: 'Laticínios', expiryDate: '2023-10-01', quantity: 3, barcode: '7891234567890', createdAt: Date.now() },
        { id: '2', name: 'Iogurte Natural', category: 'Laticínios', expiryDate: new Date(Date.now() + 3*24*60*60*1000).toISOString().split('T')[0], quantity: 2, barcode: '7894561234567', createdAt: Date.now() },
        { id: '3', name: 'Arroz 5kg', category: 'Grãos', expiryDate: new Date(Date.now() + 120*24*60*60*1000).toISOString().split('T')[0], quantity: 1, barcode: '7897897897894', createdAt: Date.now() },
      ];
      setProducts(mock);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mock));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  }, [products]);

  const handleAddProduct = (data: Omit<Product, 'id' | 'createdAt'>) => {
    if (editingProduct) {
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, ...data } : p));
      setEditingProduct(null);
    } else {
      const newProduct: Product = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: Date.now()
      };
      setProducts(prev => [...prev, newProduct]);
    }
    setIsFormOpen(false);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const importedData = await parseExcelFile(file);
      const newProducts: Product[] = importedData.map(item => ({
        ...item,
        id: crypto.randomUUID(),
        createdAt: Date.now()
      }));
      
      setProducts(prev => [...prev, ...newProducts]);
      alert(`${newProducts.length} itens importados com sucesso!`);
      setActiveTab('INVENTORY');
    } catch (err) {
      console.error(err);
      alert("Erro ao importar planilha. Verifique o formato do arquivo.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExportExcel = () => {
    exportToExcel(products);
  };

  const handleScanComplete = (data: { name: string, expiryDate: string, category: string, barcode?: string }) => {
    const newProduct: Product = {
      id: crypto.randomUUID(),
      name: data.name,
      expiryDate: data.expiryDate,
      category: data.category,
      barcode: data.barcode || '',
      quantity: 1,
      createdAt: Date.now()
    };
    setProducts(prev => [...prev, newProduct]);
    setIsScannerOpen(false);
    setActiveTab('INVENTORY');
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este item?')) {
      setProducts(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsFormOpen(true);
  };

  return (
    <div className="min-h-screen pb-24 md:pb-0 md:pl-64 bg-slate-50">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept=".xlsx, .xls, .csv" 
        onChange={handleImportExcel}
      />

      {/* Sidebar - Desktop Only */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-200 hidden md:flex flex-col p-6 z-40">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <CalendarClock className="text-white w-6 h-6" />
          </div>
          <span className="text-lg font-bold text-slate-800 tracking-tight">Controle de Vencimentos</span>
        </div>

        <nav className="space-y-1 flex-1">
          <NavButton 
            active={activeTab === 'DASHBOARD'} 
            onClick={() => setActiveTab('DASHBOARD')}
            icon={<LayoutDashboard className="w-5 h-5" />}
          >
            Dashboard
          </NavButton>
          <NavButton 
            active={activeTab === 'INVENTORY'} 
            onClick={() => setActiveTab('INVENTORY')}
            icon={<ClipboardList className="w-5 h-5" />}
          >
            Estoque
          </NavButton>
          <NavButton 
            active={false} 
            onClick={() => fileInputRef.current?.click()}
            icon={isImporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileUp className="w-5 h-5" />}
          >
            Importar Excel
          </NavButton>
          <NavButton 
            active={false} 
            onClick={handleExportExcel}
            icon={<ArrowDownToLine className="w-5 h-5" />}
          >
            Exportar Excel
          </NavButton>
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-100">
          <button 
            onClick={() => setIsScannerOpen(true)}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl flex items-center justify-center gap-3 font-bold transition-all shadow-xl shadow-indigo-100 active:scale-95"
          >
            <Scan className="w-5 h-5" />
            Scanner AI
          </button>
        </div>
      </aside>

      {/* Header */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 z-30 px-6 py-4 flex items-center justify-between">
        <div className="md:hidden flex items-center gap-3">
          <CalendarClock className="text-indigo-600 w-8 h-8" />
          <span className="text-lg font-bold text-slate-800">Controle</span>
        </div>
        <h1 className="hidden md:block text-2xl font-bold text-slate-800">
          {activeTab === 'DASHBOARD' ? 'Visão Geral' : 'Meu Estoque'}
        </h1>
        <div className="flex items-center gap-2">
           <button 
            onClick={() => setIsFormOpen(true)}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-all"
            title="Adicionar Manual"
           >
            <Plus className="w-6 h-6" />
           </button>
           <button 
             onClick={handleExportExcel}
             className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-all font-semibold"
           >
             <ArrowDownToLine className="w-5 h-5" />
             <span className="hidden sm:inline">Exportar</span>
           </button>
           <button 
             onClick={() => fileInputRef.current?.click()}
             className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition-all font-semibold"
           >
             {isImporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileUp className="w-5 h-5" />}
             <span className="hidden sm:inline">Importar</span>
           </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 max-w-5xl mx-auto">
        {activeTab === 'DASHBOARD' ? (
          <Dashboard products={products} />
        ) : (
          <ProductList products={products} onDelete={handleDelete} onEdit={handleEdit} />
        )}
      </main>

      {/* Bottom Navigation - Mobile Only */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex items-center justify-around py-3 px-6 md:hidden z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <MobileNavButton 
          active={activeTab === 'DASHBOARD'} 
          onClick={() => setActiveTab('DASHBOARD')}
          icon={<LayoutDashboard className="w-6 h-6" />}
          label="Início"
        />
        <div className="relative -mt-10">
           <button 
            onClick={() => setIsScannerOpen(true)}
            className="w-16 h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-2xl shadow-indigo-300 active:scale-90 transition-transform"
           >
            <Scan className="w-8 h-8" />
           </button>
        </div>
        <MobileNavButton 
          active={activeTab === 'INVENTORY'} 
          onClick={() => setActiveTab('INVENTORY')}
          icon={<ClipboardList className="w-6 h-6" />}
          label="Estoque"
        />
      </nav>

      {/* Floating Action Button - Desktop Add Manual */}
      <button 
        onClick={() => { setEditingProduct(null); setIsFormOpen(true); }}
        className="fixed bottom-8 right-8 hidden md:flex w-14 h-14 bg-indigo-600 text-white rounded-full items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all z-40 shadow-indigo-200"
        title="Adicionar Manualmente"
      >
        <PackagePlus className="w-6 h-6" />
      </button>

      {/* Modals */}
      {isFormOpen && (
        <ProductForm 
          onClose={() => { setIsFormOpen(false); setEditingProduct(null); }} 
          onSubmit={handleAddProduct} 
          initialData={editingProduct}
        />
      )}
      {isScannerOpen && (
        <SmartAdd 
          onClose={() => setIsScannerOpen(false)} 
          onScanComplete={handleScanComplete} 
        />
      )}
    </div>
  );
};

const NavButton = ({ active, children, onClick, icon }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${
      active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'
    }`}
  >
    {icon}
    {children}
  </button>
);

const MobileNavButton = ({ active, onClick, icon, label }: any) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 ${active ? 'text-indigo-600' : 'text-slate-400'}`}
  >
    {icon}
    <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
  </button>
);

export default App;
