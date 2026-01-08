
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
    const isCsv = file.name.toLowerCase().endsWith('.csv');
    result.diagnostics.steps.push(`Iniciando leitura de arquivo: ${file.name}`);

    // Estratégia de leitura universal para garantir funcionamento em rede local/mobile
    const dataBuffer = await new Promise<any>((resolve, reject) => {
      const reader = new FileReader();
      if (isCsv) {
        // Para CSV em rede local, ler como string ajuda a evitar problemas de buffer
        reader.readAsText(file, "UTF-8");
      } else {
        reader.readAsArrayBuffer(file);
      }
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Falha ao ler o arquivo no navegador."));
    });

    let workbook;
    if (isCsv) {
      // Se for CSV, tentamos detectar se o delimitador é ; (comum no Excel PT-BR)
      const content = dataBuffer as string;
      const delimiter = content.split('\n')[0].includes(';') ? ';' : ',';
      workbook = XLSX.read(content, { type: 'string', FS: delimiter });
    } else {
      workbook = XLSX.read(dataBuffer, { type: 'array', cellDates: true });
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });

    if (json.length === 0) {
      throw new Error("O arquivo lido está vazio ou o formato é incompatível.");
    }

    result.diagnostics.totalRowsFound = json.length;
    const keys = Object.keys(json[0]);
    result.diagnostics.columnsFound = keys;

    const aliases = {
      name: ['produto', 'nome', 'item', 'descricao', 'desc'],
      expiry: ['validade', 'vencimento', 'vence', 'data', 'datadevalidade', 'expiration', 'cadastro'],
      category: ['categoria', 'tipo', 'setor', 'category'],
      quantity: ['quantidade', 'qtd', 'estoque', 'unidades', 'quantity'],
      barcode: ['codigo', 'barras', 'ean', 'gtin', 'codigodebarras', 'barcode'],
      location: ['localizacao', 'local', 'prateleira', 'posicao', 'location']
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
      quantity: findKey(keys, aliases.quantity),
      barcode: findKey(keys, aliases.barcode),
      location: findKey(keys, aliases.location)
    };

    if (!colMap.name || !colMap.expiry) {
      throw new Error(`Colunas obrigatórias não identificadas. Verifique se o arquivo possui 'Produto' e 'Validade'. Cabeçalhos: ${keys.join(' | ')}`);
    }

    json.forEach((row, i) => {
      const name = row[colMap.name!];
      const expiry = row[colMap.expiry!];
      
      if (!name || String(name).trim() === "") return;

      let date = '';
      // Tenta converter diversos formatos de data
      const dateObj = new Date(expiry);
      if (!isNaN(dateObj.getTime()) && String(expiry).includes('-')) {
        date = dateObj.toISOString().split('T')[0];
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
        quantity: colMap.quantity ? (parseInt(row[colMap.quantity]) || 0) : 1,
        barcode: colMap.barcode ? String(row[colMap.barcode] || "") : "",
        location: colMap.location ? String(row[colMap.location] || "") : ""
      });
      result.diagnostics.successCount++;
    });

    return result;
  } catch (err: any) {
    console.error("Import Error:", err);
    throw { 
      message: err.message || "Erro ao processar arquivo.", 
      diagnostics: result.diagnostics 
    };
  }
};

export const exportToExcel = (products: Product[]) => {
  const data = products.map(p => ({
    'Código de Barras': p.barcode || '',
    'Produto': p.name,
    'Validade': formatDate(p.expiryDate),
    'Categoria': p.category,
    'Quantidade': p.quantity,
    'Localização': p.location || ''
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Estoque");
  XLSX.writeFile(wb, "Backup_Estoque.xlsx");
};
