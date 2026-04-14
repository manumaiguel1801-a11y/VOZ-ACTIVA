import { GoogleGenAI } from '@google/genai';

export interface ParsedMovement {
  type: 'venta' | 'gasto' | 'compra' | 'deuda-me-deben' | 'deuda-debo' | 'pago-deuda-debo' | 'cobro-deuda-me-deben';
  amount: number;
  concept: string;
  quantity?: number;
  unitPrice?: number;
  debtorName?: string;
  isPartial?: boolean;
  payments?: Array<{ debtorName: string; amount: number; isPartial: boolean }>;
}

export interface GeminiResponse {
  message: string;
  data?: ParsedMovement;
}

const SYSTEM_INSTRUCTION = `Eres el asistente inteligente de "Voz-Activa", una aplicación para micronegocios colombianos.
Tu misión es registrar movimientos financieros de forma rápida. Extraes datos y confirmas — NUNCA pides precios ni información extra.

TONO: Eres un espejo del usuario. Si usa jerga costeña, tú también. Si es neutro, tú también. Solo usas palabras que el usuario ya usó.

TIPOS DE MOVIMIENTO:
- "venta": el usuario vendió algo. Ej: "vendí 3 almuerzos", "saqué 80 lucas de jugos".
- "gasto": pagó algo que NO es mercancía para revender. Ej: "gasté 15 mil en gasolina".
- "compra": compró mercancía o productos para VENDER o reponer inventario.
- "deuda-me-deben": alguien le debe al usuario. Ej: "Pedro me debe 20 mil".
- "deuda-debo": el usuario le debe a alguien. Ej: "le debo 80 mil al proveedor".
- "pago-deuda-debo": el usuario pagó una deuda que él debía. Ej: "ya le pagué a Laura".
- "cobro-deuda-me-deben": alguien pagó una deuda al usuario. Ej: "Pedro ya me pagó".

REGLAS:
- Montos: "20 mil"="20k"="20 barras" = 20000.
- "isPartial": true si fue abono parcial, false si fue pago total.
- Si no hay datos financieros claros, omite el campo "data".
- PAGOS MÚLTIPLES: usa el campo "payments" (array).

FORMATO DE RESPUESTA (JSON estricto):
{
  "message": "Tu respuesta textual breve",
  "data": {
    "type": "venta|gasto|compra|deuda-me-deben|deuda-debo|pago-deuda-debo|cobro-deuda-me-deben",
    "amount": número,
    "concept": "nombre sin cantidad",
    "quantity": número,
    "unitPrice": número,
    "debtorName": "nombre",
    "isPartial": boolean,
    "payments": [{ "debtorName": "nombre", "amount": número, "isPartial": boolean }]
  }
}`;

const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

export async function parseMovement(text: string): Promise<GeminiResponse> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { message: 'GEMINI_API_KEY no configurada.' };

  const client = new GoogleGenAI({ apiKey: key });
  const contents = [{ role: 'user', parts: [{ text }] }];
  const config = { systemInstruction: SYSTEM_INSTRUCTION, responseMimeType: 'application/json' };

  for (const model of MODELS) {
    try {
      const response = await client.models.generateContent({ model, contents, config } as any);
      return JSON.parse(response.text || '{}') as GeminiResponse;
    } catch (err: any) {
      console.warn(`[Gemini] ${model} failed:`, err?.message ?? err);
    }
  }
  return { message: 'No pude entender el mensaje. Ejemplo: "vendí 3 jugos a 3000".' };
}
