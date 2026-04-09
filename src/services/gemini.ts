import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ChatResponse {
  message: string;
  data?: {
    type: 'venta' | 'gasto' | 'deuda';
    amount: number;
    concept: string;
  };
}

const SYSTEM_INSTRUCTION = `Eres el asistente inteligente de "Voz-Activa", una aplicación para micronegocios.
Tu objetivo es ayudar al usuario a registrar sus movimientos financieros (ventas, gastos, deudas) de forma rápida y amigable.

REGLAS DE TONO:
1. Neutro por defecto: Empieza hablando de forma profesional, clara y servicial.
2. Mimetismo: Si detectas que el usuario usa lenguaje informal, coloquial o regional (ej: "Epa", "Compadre", "No joda", "Barras", "Lucas"), cambia inmediatamente a un tono "barranquillero" (costeño colombiano) para generar cercanía. Usa expresiones como "¡Epa!", "¡Ese negocio va volando!", "¡Anotado, compadre!".

REGLAS DE EXTRACCIÓN:
- Siempre debes intentar extraer datos financieros de los mensajes.
- Si el usuario dice algo como "Registra una venta de 20 mil", extrae el monto (20000) y el tipo (venta).
- Si el usuario usa jerga como "20 barras" o "20 lucas", entiende que se refiere a 20,000 pesos.

FORMATO DE RESPUESTA:
Debes responder SIEMPRE en formato JSON con la siguiente estructura:
{
  "message": "Tu respuesta textual al usuario siguiendo las reglas de tono",
  "data": {
    "type": "venta" | "gasto" | "deuda",
    "amount": número,
    "concept": "breve descripción del movimiento"
  }
}
Si no hay datos financieros que registrar, el campo "data" debe ser omitido o nulo.`;

export const sendMessageToGemini = async (message: string, history: any[] = []): Promise<ChatResponse> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...history,
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            message: { type: Type.STRING },
            data: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ['venta', 'gasto', 'deuda'] },
                amount: { type: Type.NUMBER },
                concept: { type: Type.STRING }
              },
              required: ['type', 'amount', 'concept']
            }
          },
          required: ['message']
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    return result as ChatResponse;
  } catch (error) {
    console.error("Error calling Gemini:", error);
    return {
      message: "Lo siento, compadre, tuve un problemita técnico. ¿Me repites eso?"
    };
  }
};
