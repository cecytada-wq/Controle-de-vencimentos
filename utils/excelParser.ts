
import * as XLSX from 'xlsx';
import { Product } from '../types';
import { formatDate } from './helpers';

// Helper para buscar valores em um objeto ignorando case e espaços nos nomes das chaves
const getFlexibleValue = (row: any, aliases: string[]) => {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const target = alias.toLowerCase().trim();
    const foundKey = keys.find(k => k.toLowerCase().trim() === target);
    if (foundKey) return row[foundKey];
  }
  return undefined;
};

export const parseExcelFile = (file: File): Promise<Omit<Product, 'id' | 'createdAt'>[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error("Falha ao ler o arquivo.");

        // Usar ArrayBuffer (Uint8Array) é mais seguro para arquivos .xlsx
        const workbook = XLSX.read(new Uint8Array(data as ArrayBuffer), { 
          type: 'array', 
          cellDates: true,
          cellNF: false,
          cellText: false 
        });

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);

        const mappedData: Omit<Product, 'id' | 'createdAt'>[] = json.map((row: any) => {
          const name = getFlexibleValue(row, ['Nome', 'Produto', 'Item', 'Descricao', 'Name']) || '';
          const category = getFlexibleValue(row, ['Categoria', 'Tipo', 'Group', 'Category']) || 'Geral';
          const quantityStr = getFlexibleValue(row, ['Quantidade', 'Qtd', 'Estoque', 'Quantity', 'Amount']);
          const location = getFlexibleValue(row, ['Localizacao', 'Local', 'Armazenamento', 'Location']) || '';
          const barcode = String(getFlexibleValue(row, ['Codigo de Barras', 'Barcode', 'EAN', 'GTIN', 'Codigo']) || '').trim();
          
          let expiryDate = '';
          const rawDate = getFlexibleValue(row, ['Validade', 'Vencimento', 'Data', 'Expiry', 'Expiration']);

          if (rawDate instanceof Date) {
            // Ajuste para evitar problemas de fuso horário na conversão de data do Excel
            expiryDate = rawDate.toISOString().split('T')[0];
          } else if (typeof rawDate === 'string') {
            const parts = rawDate.split(/[-/]/);
            if (parts.length === 3) {
              // Se vier DD/MM/YYYY
              if (parts[0].length === 2 && parts[2].length === 4) {
                expiryDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              } else {
                expiryDate = rawDate;
              }
            } else {
              expiryDate = rawDate;
            }
          } else if (typeof rawDate === 'number') {
             // Caso o Excel envie o número serial da data
             const dateObj = XLSX.SSF.parse_date_code(rawDate);
             expiryDate = `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
          }

          return {
            name: String(name).trim(),
            category: String(category).trim(),
            quantity: parseInt(String(quantityStr)) || 1,
            expiryDate,
            location: String(location).trim(),
            barcode: barcode !== 'undefined' ? barcode : ''
          };
        }).filter(item => item.name && item.expiryDate);

        resolve(mappedData);
      } catch (err) {
        console.error("Erro no Parse do Excel:", err);
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

export const exportToExcel = (products: Product[]) => {
  if (products.length === 0) {
    alert("Não há produtos para exportar.");
    return;
  }

  try {
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

    // Gerar buffer e disparar download
    const fileName = `Estoque_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  } catch (err) {
    console.error("Erro ao exportar:", err);
    alert("Ocorreu um erro ao gerar o arquivo Excel.");
  }
};
