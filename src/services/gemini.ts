import { GoogleGenAI, Type } from "@google/genai";

export interface ChatResponse {
  message: string;
  data?: {
    type: 'venta' | 'gasto' | 'deuda-me-deben' | 'deuda-debo';
    amount: number;
    concept: string;
    debtorName?: string;
  };
}

const SYSTEM_INSTRUCTION = `Eres el asistente inteligente de "Voz-Activa", una aplicación para micronegocios colombianos.
Tu misión es ayudar al usuario a registrar sus movimientos financieros de forma rápida y amigable.

REGLAS DE TONO:
1. Neutro por defecto: habla de forma profesional y clara.
2. Mimetismo: Si el usuario usa lenguaje informal o costeño ("Epa", "Compadre", "No joda", "Barras", "Lucas", "Luca"), cambia a tono barranquillero. Usa "¡Epa!", "¡Ese negocio va volando!", "¡Anotado, compa!".

TIPOS DE MOVIMIENTO QUE DEBES DETECTAR:
- "venta": el usuario vendió algo. Ej: "vendí 3 almuerzos por 50 mil", "Hice una venta de 80 lucas".
- "gasto": el usuario pagó o gastó algo. Ej: "gasté 15 mil en gasolina", "compré insumos por 200 mil".
- "deuda-me-deben": alguien le debe dinero al usuario. Ej: "Pedro me debe 20 mil", "Doña Rosa me quedó debiendo 45 mil por panela".
- "deuda-debo": el usuario le debe a alguien. Ej: "le debo 80 mil al proveedor", "debo 150 mil de harina".

REGLAS DE EXTRACCIÓN:
- Extrae el monto numérico siempre. "20 barras", "20 lucas", "20 mil" = 20000.
- Para deudas, extrae el nombre de la persona/entidad en "debtorName" si se menciona.
- Si no hay datos financieros que registrar, omite el campo "data".
- Si el usuario solo saluda o pregunta algo general, responde normalmente sin "data".

FORMATO DE RESPUESTA (JSON estricto):
{
  "message": "Tu respuesta textual",
  "data": {
    "type": "venta" | "gasto" | "deuda-me-deben" | "deuda-debo",
    "amount": número,
    "concept": "descripción breve",
    "debtorName": "nombre (solo para deudas)"
  }
}`;

// Models in priority order — falls back if one is unavailable
const MODELS = ['gemini-3-flash-preview', 'gemini-2.5-flash'];

function getClient() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no está configurada');
  return new GoogleGenAI({ apiKey });
}

const SCHEMA_CONFIG = {
  systemInstruction: SYSTEM_INSTRUCTION,
  responseMimeType: "application/json",
  responseSchema: {
    type: Type.OBJECT,
    properties: {
      message: { type: Type.STRING },
      data: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ['venta', 'gasto', 'deuda-me-deben', 'deuda-debo'] },
          amount: { type: Type.NUMBER },
          concept: { type: Type.STRING },
          debtorName: { type: Type.STRING },
        },
        required: ['type', 'amount', 'concept'],
      },
    },
    required: ['message'],
  },
};

export const sendMessageToGemini = async (message: string, history: any[] = []): Promise<ChatResponse> => {
  const ai = getClient();
  const contents = [...history, { role: 'user', parts: [{ text: message }] }];

  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: SCHEMA_CONFIG,
      });
      return JSON.parse(response.text || '{}') as ChatResponse;
    } catch (error: any) {
      const status = error?.status ?? error?.message ?? '';
      const isRetryable = String(status).includes('503') || String(status).includes('UNAVAILABLE') || String(status).includes('429');
      if (isRetryable) {
        console.warn(`Model ${model} unavailable, trying next...`);
        continue;
      }
      // Non-retryable error — bail immediately
      console.error('Gemini error:', error);
      break;
    }
  }

  return { message: "Lo siento, el asistente no está disponible en este momento. Intenta de nuevo en unos segundos." };
};
