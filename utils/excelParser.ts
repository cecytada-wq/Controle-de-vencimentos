
import * as XLSX from 'xlsx';
import { Product } from '../types';
import { formatDate } from './helpers';

export const parseExcelFile = (file: File): Promise<Omit<Product, 'id' | 'createdAt'>[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);

        const mappedData: Omit<Product, 'id' | 'createdAt'>[] = json.map((row: any) => {
          // Busca flexível de colunas
          const name = row['Nome'] || row['Produto'] || row['Item'] || '';
          const category = row['Categoria'] || row['Tipo'] || 'Geral';
          const quantity = parseInt(row['Quantidade'] || row['Qtd'] || '1');
          const location = row['Localização'] || row['Local'] || '';
          const barcode = String(row['Código de Barras'] || row['Barcode'] || row['EAN'] || row['Código'] || '');
          
          let expiryDate = '';
          const rawDate = row['Validade'] || row['Vencimento'] || row['Data'];

          if (rawDate instanceof Date) {
            expiryDate = rawDate.toISOString().split('T')[0];
          } else if (typeof rawDate === 'string') {
            // Tenta converter DD/MM/YYYY para YYYY-MM-DD
            const parts = rawDate.split('/');
            if (parts.length === 3) {
              expiryDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            } else {
              expiryDate = rawDate; // Assume que já está em ISO ou outro formato aceitável
            }
          }

          return {
            name,
            category,
            quantity: isNaN(quantity) ? 1 : quantity,
            expiryDate,
            location,
            barcode: barcode.trim()
          };
        }).filter(item => item.name && item.expiryDate); // Remove linhas inválidas

        resolve(mappedData);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
};

export const exportToExcel = (products: Product[]) => {
  if (products.length === 0) {
    alert("Não há produtos para exportar.");
    return;
  }

  const exportData = products.map(p => ({
    'Código de Barras': p.barcode || '',
    'Produto': p.name,
    'Validade': formatDate(p.expiryDate),
    'Categoria': p.category,
    'Quantidade': p.quantity,
    'Localização': p.location || '',
    'Data de Cadastro': new Date(p.createdAt).toLocaleDateString('pt-BR')
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Estoque");

  // Ajustar largura das colunas
  const wscols = [
    { wch: 20 }, // Código de Barras
    { wch: 30 }, // Produto
    { wch: 15 }, // Validade
    { wch: 20 }, // Categoria
    { wch: 12 }, // Quantidade
    { wch: 20 }, // Localização
    { wch: 18 }, // Cadastro
  ];
  worksheet['!cols'] = wscols;

  const fileName = `Estoque_ControleDeVencimentos_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};
