
import React, { useState } from 'react';
import { Product, ExpiryStatus } from '../types';
import { 
  calculateDaysRemaining, 
  getExpiryStatus, 
  formatDate, 
  getStatusColor 
} from '../utils/helpers';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  Trash2, 
  Edit3, 
  ChevronRight,
  AlertTriangle,
  MapPin,
  Layers,
  Barcode
} from 'lucide-react';

interface ProductListProps {
  products: Product[];
  onDelete: (id: string) => void;
  onEdit: (product: Product) => void;
}

const ProductList: React.FC<ProductListProps> = ({ products, onDelete, onEdit }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<ExpiryStatus | 'ALL'>('ALL');

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.barcode && p.barcode.includes(searchTerm));
    const days = calculateDaysRemaining(p.expiryDate);
    const status = getExpiryStatus(days);
    const matchesFilter = filterStatus === 'ALL' || status === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  // Sort: Expired first, then by date
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-8">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nome, categoria ou código..."
            className="w-full pl-12 pr-5 py-3.5 bg-white border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 no-scrollbar">
          <FilterButton active={filterStatus === 'ALL'} onClick={() => setFilterStatus('ALL')}>Todos</FilterButton>
          <FilterButton active={filterStatus === ExpiryStatus.EXPIRED} onClick={() => setFilterStatus(ExpiryStatus.EXPIRED)} color="rose">Vencidos</FilterButton>
          <FilterButton active={filterStatus === ExpiryStatus.WARNING} onClick={() => setFilterStatus(ExpiryStatus.WARNING)} color="amber">Atenção</FilterButton>
          <FilterButton active={filterStatus === ExpiryStatus.SAFE} onClick={() => setFilterStatus(ExpiryStatus.SAFE)} color="emerald">Seguros</FilterButton>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {sortedProducts.length > 0 ? (
          sortedProducts.map(product => (
            <ProductItem 
              key={product.id} 
              product={product} 
              onDelete={onDelete} 
              onEdit={onEdit} 
            />
          ))
        ) : (
          <div className="bg-white rounded-[2.5rem] p-16 text-center border-2 border-dashed border-slate-100">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-10 h-10 text-slate-200" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Sem resultados</h3>
            <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">Tente buscar por outro termo ou mude o filtro de status.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const FilterButton = ({ active, children, onClick, color = 'indigo' }: any) => {
  const colors: any = {
    indigo: 'border-indigo-100 text-indigo-600 bg-indigo-50',
    rose: 'border-rose-100 text-rose-600 bg-rose-50',
    amber: 'border-amber-100 text-amber-600 bg-amber-50',
    emerald: 'border-emerald-100 text-emerald-600 bg-emerald-50'
  };
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider border transition-all whitespace-nowrap active:scale-95 ${
        active ? colors[color] : 'border-slate-50 text-slate-400 bg-white hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
};

const ProductItem: React.FC<{ 
  product: Product; 
  onDelete: (id: string) => void; 
  onEdit: (product: Product) => void; 
}> = ({ product, onDelete, onEdit }) => {
  const daysRemaining = calculateDaysRemaining(product.expiryDate);
  const status = getExpiryStatus(daysRemaining);
  const statusClasses = getStatusColor(status);

  return (
    <div className="group bg-white p-5 rounded-[2rem] border border-slate-50 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 hover:border-indigo-100 transition-all relative overflow-hidden">
      <div className="flex items-center gap-5">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shrink-0 shadow-sm ${statusClasses}`}>
          <span className="text-xl font-black">{product.name.charAt(0).toUpperCase()}</span>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-black text-slate-800 truncate pr-3 text-lg leading-none">{product.name}</h3>
            <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-tighter border shrink-0 ${statusClasses}`}>
              {status === ExpiryStatus.EXPIRED ? 'Expirou' : `${daysRemaining} dias`}
            </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-400 font-bold uppercase tracking-tighter">
            {product.barcode && (
               <span className="flex items-center gap-1.5 text-indigo-600">
                <Barcode className="w-3.5 h-3.5" /> {product.barcode}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-300" /> {product.category}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-slate-300">Qtd:</span> {product.quantity}
            </span>
            {product.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-300" /> {product.location}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-slate-500">
              Vence: {formatDate(product.expiryDate)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={() => onEdit(product)}
            className="p-3 bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-all"
          >
            <Edit3 className="w-5 h-5" />
          </button>
          <button 
            onClick={() => onDelete(product.id)}
            className="p-3 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-all"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      {/* Visual Health Indicator Bar */}
      <div className="absolute bottom-0 left-0 h-1.5 bg-slate-50 w-full">
        <div 
          className={`h-full transition-all duration-1000 ease-out rounded-full ${
            status === ExpiryStatus.EXPIRED ? 'bg-rose-500' : 
            status === ExpiryStatus.WARNING ? 'bg-amber-500' : 'bg-emerald-500'
          }`} 
          style={{ width: `${Math.max(0, Math.min(100, (daysRemaining / 30) * 100))}%` }}
        ></div>
      </div>
    </div>
  );
};

export default ProductList;
