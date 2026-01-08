
import * as XLSX from 'xlsx';
import { Product } from '../types';
import { formatDate } from './helpers';

/**
 * Normaliza uma string para comparação: remove acentos, espaços extras e converte para minúsculas.
 */
const normalizeString = (str: string): string => {
  return str
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

/**
 * Busca flexível de valores em uma linha da planilha.
 * Tenta encontrar a coluna ideal baseada em uma lista de sinônimos.
 */
const findValueByAliases = (row: any, aliases: string[]) => {
  const rowKeys = Object.keys(row);
  const normalizedAliases = aliases.map(normalizeString);

  // 1. Tenta encontrar por correspondência exata normalizada
  for (const key of rowKeys) {
    const normKey = normalizeString(key);
    if (normalizedAliases.includes(normKey)) {
      return row[key];
    }
  }

  // 2. Tenta encontrar se o cabeçalho contém algum dos aliases
  for (const key of rowKeys) {
    const normKey = normalizeString(key);
    for (const alias of normalizedAliases) {
      if (normKey.includes(alias)) {
        return row[key];
      }
    }
  }
  
  return undefined;
};

export const parseExcelFile = (file: File): Promise<Omit<Product, 'id' | 'createdAt'>[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error("O navegador não conseguiu ler o conteúdo do arquivo.");

        // Converter ArrayBuffer para Uint8Array garante compatibilidade máxima com SheetJS (.xlsx, .xls, .csv)
        const arr = new Uint8Array(data as ArrayBuffer);
        const workbook = XLSX.read(arr, { 
          type: 'array',
          cellDates: true, // Importante para que datas do Excel venham como objetos Date
          cellText: false,
          cellNF: false
        });

        if (!workbook.SheetNames.length) throw new Error("Arquivo Excel vazio.");

        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        if (json.length === 0) throw new Error("Nenhum dado encontrado na primeira aba.");

        console.log("Colunas detectadas na primeira linha:", Object.keys(json[0]));

        const results: Omit<Product, 'id' | 'createdAt'>[] = [];

        for (const row of json) {
          const name = findValueByAliases(row, ['produto', 'nome', 'item', 'descricao', 'name']);
          const expiryRaw = findValueByAliases(row, ['validade', 'vencimento', 'data', 'expiry', 'expiration', 'vence']);
          const category = findValueByAliases(row, ['categoria', 'tipo', 'grupo', 'category', 'group']) || 'Geral';
          const quantity = findValueByAliases(row, ['quantidade', 'qtd', 'estoque', 'quantity', 'amount']) || 1;
          const location = findValueByAliases(row, ['localizacao', 'local', 'setor', 'location']) || '';
          const barcode = findValueByAliases(row, ['codigo', 'barcode', 'ean', 'gtin']) || '';

          // Se não tiver nome, ignora a linha (pode ser rodapé ou linha vazia)
          if (!name || String(name).trim() === "") continue;

          let expiryDate = '';

          // Lógica robusta para extração de data
          if (expiryRaw instanceof Date) {
            // Ajuste para fuso horário local ao converter Date do Excel
            const offset = expiryRaw.getTimezoneOffset();
            const adjustedDate = new Date(expiryRaw.getTime() - (offset * 60 * 1000));
            expiryDate = adjustedDate.toISOString().split('T')[0];
          } else if (typeof expiryRaw === 'number') {
            const dateObj = XLSX.SSF.parse_date_code(expiryRaw);
            expiryDate = `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
          } else if (typeof expiryRaw === 'string' && expiryRaw.trim() !== "") {
            // Tenta converter formatos comuns de string como 31/12/2024 ou 2024-12-31
            const parts = expiryRaw.trim().split(/[-/.]/);
            if (parts.length === 3) {
              if (parts[2].length === 4) { // DD/MM/YYYY
                expiryDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              } else if (parts[0].length === 4) { // YYYY/MM/DD
                expiryDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
              }
            }
          }

          if (expiryDate) {
            results.push({
              name: String(name).trim(),
              expiryDate,
              category: String(category).trim(),
              quantity: Number(quantity) || 1,
              location: String(location).trim(),
              barcode: String(barcode).trim()
            });
          } else {
            console.warn(`Produto "${name}" ignorado por falta de data de validade válida.`, { expiryRaw });
          }
        }

        if (results.length === 0) {
          throw new Error("Não foi possível encontrar as colunas de 'Nome' e 'Validade' em nenhuma linha. Use o botão 'Baixar Modelo' para ver o formato correto.");
        }

        resolve(results);
      } catch (err: any) {
        console.error("Erro interno no parse:", err);
        reject(err.message || "Falha ao processar o arquivo.");
      }
    };

    reader.onerror = () => reject("Ocorreu um erro físico na leitura do arquivo.");
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
    
    const wscols = [
      { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 20 }
    ];
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, `Backup_Estoque_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (err) {
    alert("Erro ao exportar arquivo.");
  }
};

export const downloadTemplate = () => {
  const templateData = [
    {
      'Produto': 'Exemplo Leite',
      'Validade': '31/12/2025',
      'Categoria': 'Laticinios',
      'Quantidade': 10,
      'Localizacao': 'Prateleira A',
      'Codigo de Barras': '7890000000000'
    }
  ];
  const worksheet = XLSX.utils.json_to_sheet(templateData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo");
  XLSX.writeFile(workbook, "Modelo_Importacao_Vencimentos.xlsx");
};
