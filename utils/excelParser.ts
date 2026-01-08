
import * as XLSX from 'xlsx';
import { Product } from '../types';
import { formatDate } from './helpers';

/**
 * Busca flexível de valores em uma linha da planilha.
 * Tenta encontrar a coluna ideal baseada em uma lista de sinônimos.
 */
const findValueByAliases = (row: any, aliases: string[]) => {
  const rowKeys = Object.keys(row);
  for (const alias of aliases) {
    const normalizedAlias = alias.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const foundKey = rowKeys.find(key => {
      const normalizedKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      return normalizedKey === normalizedAlias || normalizedKey.includes(normalizedAlias);
    });
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
        if (!data) throw new Error("Não foi possível ler o conteúdo do arquivo.");

        // XLSX.read com ArrayBuffer é o padrão mais seguro para .xlsx e .csv
        const workbook = XLSX.read(data, { 
          type: 'array',
          cellDates: true,
          cellText: false,
          cellNF: false
        });

        if (!workbook.SheetNames.length) {
          throw new Error("O arquivo Excel parece estar vazio.");
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (json.length === 0) {
          throw new Error("Nenhuma linha de dados encontrada na primeira aba da planilha.");
        }

        const results: Omit<Product, 'id' | 'createdAt'>[] = [];

        for (const row of json as any[]) {
          const name = findValueByAliases(row, ['Produto', 'Nome', 'Item', 'Descricao', 'Name']);
          const expiryRaw = findValueByAliases(row, ['Validade', 'Vencimento', 'Data', 'Expiry', 'Expiration', 'Vence']);
          const category = findValueByAliases(row, ['Categoria', 'Tipo', 'Grupo', 'Category', 'Group']) || 'Geral';
          const quantity = findValueByAliases(row, ['Quantidade', 'Qtd', 'Estoque', 'Quantity', 'Amount']) || 1;
          const location = findValueByAliases(row, ['Localizacao', 'Local', 'Armazenamento', 'Location', 'Setor']) || '';
          const barcode = findValueByAliases(row, ['Codigo', 'Barcode', 'EAN', 'GTIN']) || '';

          if (!name) continue; // Ignora linhas sem nome de produto

          let expiryDate = '';
          if (expiryRaw instanceof Date) {
            expiryDate = expiryRaw.toISOString().split('T')[0];
          } else if (typeof expiryRaw === 'number') {
            const dateObj = XLSX.SSF.parse_date_code(expiryRaw);
            expiryDate = `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
          } else if (typeof expiryRaw === 'string' && expiryRaw.trim()) {
            // Tenta converter DD/MM/YYYY para YYYY-MM-DD
            const parts = expiryRaw.trim().split(/[-/.]/);
            if (parts.length === 3) {
              if (parts[2].length === 4) { // Formato DD/MM/YYYY
                expiryDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              } else if (parts[0].length === 4) { // Formato YYYY/MM/DD
                expiryDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
              }
            } else {
              expiryDate = expiryRaw;
            }
          }

          if (name && expiryDate) {
            results.push({
              name: String(name).trim(),
              expiryDate,
              category: String(category).trim(),
              quantity: Number(quantity) || 1,
              location: String(location).trim(),
              barcode: String(barcode).trim()
            });
          }
        }

        if (results.length === 0) {
          throw new Error("Não foi possível encontrar colunas de 'Nome' e 'Validade' válidas. Verifique os títulos das colunas.");
        }

        resolve(results);
      } catch (err: any) {
        reject(err.message || "Erro desconhecido ao processar planilha.");
      }
    };

    reader.onerror = () => reject("Erro na leitura do arquivo pelo navegador.");
    reader.readAsArrayBuffer(file);
  });
};

export const exportToExcel = (products: Product[]) => {
  try {
    const data = products.map(p => ({
      'Produto': p.name,
      'Validade': formatDate(p.expiryDate),
      'Categoria': p.category,
      'Quantidade': p.quantity,
      'Localizacao': p.location || '',
      'Codigo de Barras': p.barcode || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Estoque");
    
    // Auto-ajuste de colunas simples
    const wscols = Object.keys(data[0] || {}).map(() => ({ wch: 20 }));
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, `Estoque_Vencimentos_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (err) {
    alert("Erro ao exportar arquivo.");
  }
};

/**
 * Gera uma planilha modelo para o usuário saber o que preencher
 */
export const downloadTemplate = () => {
  const templateData = [
    {
      'Produto': 'Exemplo Leite',
      'Validade': '31/12/2025',
      'Categoria': 'Laticinios',
      'Quantidade': 5,
      'Localizacao': 'Armario A',
      'Codigo de Barras': '7891234567890'
    }
  ];
  const worksheet = XLSX.utils.json_to_sheet(templateData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo_Importacao");
  XLSX.writeFile(workbook, "Modelo_Importacao_Vencimentos.xlsx");
};
