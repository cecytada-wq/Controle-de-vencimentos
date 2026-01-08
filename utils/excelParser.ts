
import * as XLSX from 'xlsx';
import { Product } from '../types';
import { formatDate } from './helpers';

export interface ImportResult {
  products: Omit<Product, 'id' | 'createdAt'>[];
  diagnostics: {
    totalRowsFound: number;
    successCount: number;
    skippedRows: { row: number; reason: string }[];
    columnsFound: string[];
    steps: string[];
    rawPreview: any[];
  };
}

const normalize = (str: any): string => {
  if (!str) return "";
  return str.toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
};

export const parseExcelFile = async (file: File): Promise<ImportResult> => {
  const result: ImportResult = {
    products: [],
    diagnostics: {
      totalRowsFound: 0,
      successCount: 0,
      skippedRows: [],
      columnsFound: [],
      steps: [],
      rawPreview: []
    }
  };

  try {
    result.diagnostics.steps.push(`Lendo arquivo: ${file.name} (${file.size} bytes)`);
    
    // Usando arrayBuffer diretamente (mais moderno e seguro que FileReader)
    const data = await file.arrayBuffer();
    result.diagnostics.steps.push("Arquivo carregado na memória.");

    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
    result.diagnostics.steps.push("Estrutura Excel processada.");

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    
    if (json.length === 0) throw new Error("A planilha está vazia ou o formato não é suportado.");

    result.diagnostics.totalRowsFound = json.length;
    result.diagnostics.rawPreview = json.slice(0, 2);

    const firstRow = json[0];
    const keys = Object.keys(firstRow);
    result.diagnostics.columnsFound = keys;

    const aliases = {
      name: ['produto', 'nome', 'item', 'desc'],
      expiry: ['validade', 'vencimento', 'vence', 'data', 'val'],
      category: ['categoria', 'tipo', 'cat'],
      quantity: ['quantidade', 'qtd', 'estoque']
    };

    const findKey = (rowKeys: string[], targets: string[]) => {
      return rowKeys.find(k => {
        const nk = normalize(k);
        return targets.some(t => nk === normalize(t) || nk.includes(normalize(t)));
      });
    };

    const colMap = {
      name: findKey(keys, aliases.name),
      expiry: findKey(keys, aliases.expiry),
      category: findKey(keys, aliases.category),
      quantity: findKey(keys, aliases.quantity)
    };

    if (!colMap.name || !colMap.expiry) {
      throw new Error(`Colunas não identificadas.\nPreciso de 'Produto' e 'Validade'.\nEncontrei apenas: ${keys.join(", ")}`);
    }

    json.forEach((row, i) => {
      const name = row[colMap.name!];
      const expiry = row[colMap.expiry!];
      
      if (!name || String(name).trim() === "") return;

      let date = '';
      if (expiry instanceof Date) {
        date = expiry.toISOString().split('T')[0];
      } else {
        const s = String(expiry).replace(/[^\d/.-]/g, '');
        const p = s.split(/[/-]/);
        if (p.length === 3) {
          if (p[2].length === 4) date = `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
          else if (p[0].length === 4) date = `${p[0]}-${p[1].padStart(2,'0')}-${p[2].padStart(2,'0')}`;
        }
      }

      if (!date || date.includes('NaN')) {
        result.diagnostics.skippedRows.push({ row: i+2, reason: `Data inválida: ${expiry}` });
        return;
      }

      result.products.push({
        name: String(name),
        expiryDate: date,
        category: colMap.category ? String(row[colMap.category] || "Geral") : "Geral",
        quantity: colMap.quantity ? (parseInt(row[colMap.quantity]) || 1) : 1
      });
      result.diagnostics.successCount++;
    });

    return result;
  } catch (err: any) {
    result.diagnostics.steps.push(`FALHA CRÍTICA: ${err.message}`);
    throw { message: err.message, diagnostics: result.diagnostics };
  }
};

export const exportToExcel = (products: Product[]) => {
  const data = products.map(p => ({
    'Produto': p.name,
    'Validade': formatDate(p.expiryDate),
    'Categoria': p.category,
    'Quantidade': p.quantity
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Estoque");
  XLSX.writeFile(wb, "Backup.xlsx");
};

export const downloadTemplate = () => {
  const data = [{ 'Produto': 'Item Exemplo', 'Validade': '31/12/2025', 'Categoria': 'Alimentos', 'Quantidade': 1 }];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Modelo");
  XLSX.writeFile(wb, "Modelo.xlsx");
};
