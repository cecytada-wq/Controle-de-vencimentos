
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
  };
}

const normalize = (str: any): string => {
  if (str === null || str === undefined) return "";
  return str.toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

const findKey = (row: any, aliases: string[]): string | undefined => {
  const keys = Object.keys(row);
  const normalizedAliases = aliases.map(normalize);
  
  // Busca exata
  const exactMatch = keys.find(k => normalizedAliases.includes(normalize(k)));
  if (exactMatch) return exactMatch;

  // Busca parcial
  return keys.find(k => {
    const normK = normalize(k);
    return normalizedAliases.some(alias => normK.includes(alias));
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
        steps: []
      }
    };

    result.diagnostics.steps.push(`Iniciando leitura do arquivo: ${file.name}`);

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error("Conteúdo do arquivo vazio.");

        result.diagnostics.steps.push("Arquivo lido como ArrayBuffer. Iniciando processamento SheetJS.");
        
        const arr = new Uint8Array(data as ArrayBuffer);
        const workbook = XLSX.read(arr, { type: 'array', cellDates: true });

        if (!workbook.SheetNames.length) throw new Error("O Excel não contém abas.");
        
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        result.diagnostics.totalRowsFound = json.length;
        if (json.length === 0) throw new Error("A aba '" + sheetName + "' está vazia.");

        const firstRow = json[0];
        result.diagnostics.columnsFound = Object.keys(firstRow);
        result.diagnostics.steps.push(`Encontradas ${json.length} linhas e colunas: ${result.diagnostics.columnsFound.join(", ")}`);

        const aliases = {
          name: ['produto', 'nome', 'item', 'descricao', 'name'],
          expiry: ['validade', 'vencimento', 'data', 'expiry', 'expiration', 'vence'],
          category: ['categoria', 'tipo', 'grupo', 'category'],
          quantity: ['quantidade', 'qtd', 'estoque', 'quantity'],
          location: ['localizacao', 'local', 'setor'],
          barcode: ['codigo', 'barcode', 'ean', 'gtin']
        };

        const colMapping = {
          name: findKey(firstRow, aliases.name),
          expiry: findKey(firstRow, aliases.expiry),
          category: findKey(firstRow, aliases.category),
          quantity: findKey(firstRow, aliases.quantity),
          location: findKey(firstRow, aliases.location),
          barcode: findKey(firstRow, aliases.barcode)
        };

        if (!colMapping.name || !colMapping.expiry) {
          throw new Error(`Colunas obrigatórias não identificadas.\nDetectadas: ${result.diagnostics.columnsFound.join(", ")}\nEsperadas: Alguma variação de 'Produto' e 'Validade'.`);
        }

        result.diagnostics.steps.push("Mapeamento de colunas concluído. Iniciando validação de dados.");

        json.forEach((row, index) => {
          const rowNum = index + 2; // +1 zero-based, +1 header row
          const nameValue = row[colMapping.name!];
          const expiryValue = row[colMapping.expiry!];

          if (!nameValue || String(nameValue).trim() === "") {
            result.diagnostics.skippedRows.push({ row: rowNum, reason: "Nome do produto vazio" });
            return;
          }

          let expiryDate = '';
          if (expiryValue instanceof Date) {
            const offset = expiryValue.getTimezoneOffset();
            const adj = new Date(expiryValue.getTime() - (offset * 60 * 1000));
            expiryDate = adj.toISOString().split('T')[0];
          } else if (typeof expiryValue === 'number') {
            const d = XLSX.SSF.parse_date_code(expiryValue);
            expiryDate = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
          } else if (typeof expiryValue === 'string' && expiryValue.trim() !== "") {
            const parts = expiryValue.trim().split(/[-/.]/);
            if (parts.length === 3) {
              if (parts[2].length === 4) expiryDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              else if (parts[0].length === 4) expiryDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            }
          }

          if (!expiryDate) {
            result.diagnostics.skippedRows.push({ row: rowNum, reason: `Data inválida: "${expiryValue}"` });
            return;
          }

          result.products.push({
            name: String(nameValue).trim(),
            expiryDate,
            category: colMapping.category ? String(row[colMapping.category]).trim() : 'Geral',
            quantity: colMapping.quantity ? (Number(row[colMapping.quantity]) || 1) : 1,
            location: colMapping.location ? String(row[colMapping.location]).trim() : '',
            barcode: colMapping.barcode ? String(row[colMapping.barcode]).trim() : ''
          });
          result.diagnostics.successCount++;
        });

        result.diagnostics.steps.push(`Processamento finalizado. Itens válidos: ${result.diagnostics.successCount}`);
        resolve(result);

      } catch (err: any) {
        result.diagnostics.steps.push(`ERRO CRÍTICO: ${err.message}`);
        reject({ message: err.message, diagnostics: result.diagnostics });
      }
    };

    reader.onerror = () => reject({ message: "Erro físico de leitura.", diagnostics: result.diagnostics });
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
    XLSX.writeFile(wb, `Estoque_Backup.xlsx`);
  } catch (e) { alert("Erro ao exportar."); }
};

export const downloadTemplate = () => {
  const data = [{ 'Produto': 'Leite Exemplo', 'Validade': '31/12/2025', 'Categoria': 'Laticinios', 'Quantidade': 1, 'Localizacao': 'Geladeira', 'Codigo de Barras': '' }];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Modelo");
  XLSX.writeFile(wb, "Modelo_Importacao.xlsx");
};
