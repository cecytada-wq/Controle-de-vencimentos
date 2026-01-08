
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
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^a-z0-9]/g, "")       // Remove símbolos e espaços
    .trim();
};

const findKey = (row: any, aliases: string[]): string | undefined => {
  const keys = Object.keys(row);
  const normalizedAliases = aliases.map(normalize);
  
  // 1. Tenta encontrar a coluna pelo nome exato ou contido
  return keys.find(k => {
    const normK = normalize(k);
    return normalizedAliases.some(alias => normK !== "" && (normK === alias || normK.includes(alias)));
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

    result.diagnostics.steps.push(`Iniciando leitura do arquivo: ${file.name}`);

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error("O conteúdo do arquivo parece estar vazio.");

        result.diagnostics.steps.push("Convertendo arquivo para ArrayBuffer...");
        const arr = new Uint8Array(data as ArrayBuffer);
        
        result.diagnostics.steps.push("Executando leitura SheetJS (XLSX)...");
        const workbook = XLSX.read(arr, { type: 'array', cellDates: true });
        
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        result.diagnostics.steps.push(`Lendo aba: "${sheetName}"`);
        
        // Converte para JSON. defval: "" garante que colunas vazias não quebrem o objeto
        const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        
        if (json.length === 0) throw new Error("A planilha lida não contém nenhuma linha de dados.");

        // Amostra para o usuário ver o que o sistema "enxergou"
        result.diagnostics.rawPreview = json.slice(0, 2);
        result.diagnostics.totalRowsFound = json.length;

        // Tenta achar a linha que parece ser o cabeçalho (pula vazias)
        let headerRow = json[0];
        result.diagnostics.columnsFound = Object.keys(headerRow);
        
        const aliases = {
          name: ['produto', 'nome', 'item', 'desc', 'artigo', 'label'],
          expiry: ['validade', 'vencimento', 'vence', 'data', 'expiry', 'exp', 'val', 'datadevalidade'],
          category: ['categoria', 'tipo', 'grupo', 'cat', 'secao'],
          quantity: ['quantidade', 'qtd', 'estoque', 'quant', 'unidades', 'un'],
          location: ['local', 'setor', 'posicao', 'armario', 'prateleira'],
          barcode: ['codigo', 'barcode', 'ean', 'gtin', 'cod']
        };

        const colMapping = {
          name: findKey(headerRow, aliases.name),
          expiry: findKey(headerRow, aliases.expiry),
          category: findKey(headerRow, aliases.category),
          quantity: findKey(headerRow, aliases.quantity),
          location: findKey(headerRow, aliases.location),
          barcode: findKey(headerRow, aliases.barcode)
        };

        result.diagnostics.steps.push(`Mapeamento: Nome=${colMapping.name || '?'}, Validade=${colMapping.expiry || '?'}`);

        if (!colMapping.name || !colMapping.expiry) {
          throw new Error(`Não foi possível identificar as colunas obrigatórias.\nDetectadas: ${result.diagnostics.columnsFound.join(", ")}\n\nCertifique-se que sua planilha tenha colunas chamadas 'Produto' e 'Validade'.`);
        }

        json.forEach((row, index) => {
          const rowNum = index + 2; // +1 zero-based, +1 header
          const nameVal = row[colMapping.name!];
          const expiryVal = row[colMapping.expiry!];

          if (!nameVal || String(nameVal).trim() === "") return;

          let expiryDate = '';
          
          // Tratamento de Data ultra-robusto
          if (expiryVal instanceof Date && !isNaN(expiryVal.getTime())) {
            expiryDate = expiryVal.toISOString().split('T')[0];
          } else if (typeof expiryVal === 'number') {
            const d = XLSX.SSF.parse_date_code(expiryVal);
            expiryDate = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
          } else {
            const dateStr = String(expiryVal).trim();
            const parts = dateStr.split(/[-/.]/);
            if (parts.length === 3) {
              // Formatos DD/MM/YYYY ou YYYY/MM/DD
              if (parts[2].length === 4) expiryDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              else if (parts[0].length === 4) expiryDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            }
          }

          if (!expiryDate || expiryDate.includes('NaN')) {
            result.diagnostics.skippedRows.push({ row: rowNum, reason: `Data ilegível: "${expiryVal}"` });
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

        resolve(result);
      } catch (err: any) {
        result.diagnostics.steps.push(`ERRO: ${err.message}`);
        reject({ message: err.message, diagnostics: result.diagnostics });
      }
    };
    
    reader.onerror = () => reject({ message: "Erro físico ao ler arquivo do disco.", diagnostics: result.diagnostics });
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
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estoque");
    XLSX.writeFile(wb, `Backup_Estoque.xlsx`);
  } catch (e) {
    console.error("Erro exportação", e);
  }
};

export const downloadTemplate = () => {
  const data = [{ 'Produto': 'Arroz 5kg', 'Validade': '20/12/2025', 'Categoria': 'Graos', 'Quantidade': 2 }];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Modelo");
  XLSX.writeFile(wb, "Modelo_Importacao.xlsx");
};
