
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
  if (str === null || str === undefined) return "";
  return str.toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "") // Remove TUDO que não for letra ou número
    .trim();
};

const findKey = (row: any, aliases: string[]): string | undefined => {
  const keys = Object.keys(row);
  const normalizedAliases = aliases.map(normalize);
  
  // 1. Busca exata (normalizada)
  const exactMatch = keys.find(k => normalizedAliases.includes(normalize(k)));
  if (exactMatch) return exactMatch;

  // 2. Busca por contém (ex: "Nome do Produto" contém "produto")
  return keys.find(k => {
    const normK = normalize(k);
    return normalizedAliases.some(alias => normK !== "" && normK.includes(alias));
  });
};

export const parseExcelFile = (file: File): Promise<ImportResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
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

    result.diagnostics.steps.push(`Lendo arquivo: ${file.name}`);

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error("Arquivo vazio ou ilegível.");

        const arr = new Uint8Array(data as ArrayBuffer);
        const workbook = XLSX.read(arr, { type: 'array', cellDates: true, cellText: false });
        
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // Tentamos ler com cabeçalho automático primeiro
        let json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        
        if (json.length === 0) throw new Error("A planilha parece estar vazia.");

        // DIAGNÓSTICO: Pegar amostra bruta
        result.diagnostics.rawPreview = json.slice(0, 3);
        
        // Tentar encontrar a linha de cabeçalho real se a primeira estiver vazia
        let headerRowIndex = 0;
        while (headerRowIndex < Math.min(json.length, 10)) {
          const row = json[headerRowIndex];
          const keys = Object.keys(row);
          const hasData = keys.some(k => row[k] !== "");
          if (hasData) break;
          headerRowIndex++;
        }
        
        const firstValidRow = json[headerRowIndex];
        result.diagnostics.columnsFound = Object.keys(firstValidRow);
        
        const aliases = {
          name: ['produto', 'nome', 'item', 'desc', 'name', 'artigo'],
          expiry: ['validade', 'vencimento', 'vence', 'data', 'expiry', 'exp', 'val'],
          category: ['categoria', 'tipo', 'grupo', 'cat'],
          quantity: ['quantidade', 'qtd', 'estoque', 'quant', 'unidades'],
          location: ['local', 'setor', 'posicao', 'armario'],
          barcode: ['codigo', 'barcode', 'ean', 'gtin', 'cod']
        };

        const colMapping = {
          name: findKey(firstValidRow, aliases.name),
          expiry: findKey(firstValidRow, aliases.expiry),
          category: findKey(firstValidRow, aliases.category),
          quantity: findKey(firstValidRow, aliases.quantity),
          location: findKey(firstValidRow, aliases.location),
          barcode: findKey(firstValidRow, aliases.barcode)
        };

        if (!colMapping.name || !colMapping.expiry) {
          throw new Error(`Não encontrei as colunas 'Produto' e 'Validade'.\nColunas detectadas: ${result.diagnostics.columnsFound.join(", ")}`);
        }

        json.slice(headerRowIndex).forEach((row, index) => {
          const rowNum = headerRowIndex + index + 2;
          const nameVal = row[colMapping.name!];
          const expiryVal = row[colMapping.expiry!];

          if (!nameVal || String(nameVal).trim() === "") return;

          let expiryDate = '';
          // Lógica de Data Robusta
          if (expiryVal instanceof Date && !isNaN(expiryVal.getTime())) {
            expiryDate = expiryVal.toISOString().split('T')[0];
          } else if (typeof expiryVal === 'number') {
            const d = XLSX.SSF.parse_date_code(expiryVal);
            expiryDate = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
          } else {
            const dateStr = String(expiryVal).trim();
            const parts = dateStr.split(/[-/.]/);
            if (parts.length === 3) {
              if (parts[2].length === 4) expiryDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              else if (parts[0].length === 4) expiryDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            }
          }

          if (!expiryDate || expiryDate === 'NaN-NaN-NaN') {
            result.diagnostics.skippedRows.push({ row: rowNum, reason: `Data inválida: "${expiryVal}"` });
            return;
          }

          result.products.push({
            name: String(nameVal).trim(),
            expiryDate,
            category: colMapping.category ? String(row[colMapping.category] || "Geral") : "Geral",
            quantity: colMapping.quantity ? (parseInt(row[colMapping.quantity]) || 1) : 1,
            location: colMapping.location ? String(row[colMapping.location] || "") : "",
            barcode: colMapping.barcode ? String(row[colMapping.barcode] || "") : ""
          });
          result.diagnostics.successCount++;
        });

        result.diagnostics.totalRowsFound = json.length;
        resolve(result);
      } catch (err: any) {
        reject({ message: err.message, diagnostics: result.diagnostics });
      }
    };
    reader.readAsArrayBuffer(file);
  });
};

export const exportToExcel = (products: Product[]) => {
  const data = products.map(p => ({
    'Produto': p.name,
    'Validade': formatDate(p.expiryDate),
    'Categoria': p.category,
    'Quantidade': p.quantity,
    'Localizacao': p.location || '',
    'Codigo de Barras': p.barcode || ''
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Estoque");
  XLSX.writeFile(wb, `Backup_Estoque.xlsx`);
};

export const downloadTemplate = () => {
  const data = [{ 'Produto': 'Arroz 5kg', 'Validade': '20/12/2025', 'Categoria': 'Graos', 'Quantidade': 2 }];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Modelo");
  XLSX.writeFile(wb, "Modelo_Importacao.xlsx");
};
