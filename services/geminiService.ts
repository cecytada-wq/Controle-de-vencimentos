
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const scanProductFromImage = async (base64Image: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image,
            },
          },
          {
            text: "Extraia o nome do produto, a data de validade (formato YYYY-MM-DD), o código de barras (EAN/GTIN se visível) e sugira uma categoria curta. Se não encontrar a data, tente estimar ou retorne null. Responda apenas em JSON.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            expiryDate: { type: Type.STRING },
            category: { type: Type.STRING },
            barcode: { type: Type.STRING }
          },
          required: ["name", "expiryDate", "category", "barcode"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};
