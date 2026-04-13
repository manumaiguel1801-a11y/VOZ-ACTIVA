import { GoogleGenAI, Type } from "@google/genai";

export interface ChatResponse {
  message: string;
  data?: {
    type: 'venta' | 'gasto' | 'compra' | 'deuda-me-deben' | 'deuda-debo' | 'pago-deuda-debo' | 'cobro-deuda-me-deben';
    amount: number;
    concept: string;
    quantity?: number;
    unitPrice?: number;
    debtorName?: string;
    isPartial?: boolean;
    payments?: Array<{ debtorName: string; amount: number; isPartial: boolean }>;
  };
}

const SYSTEM_INSTRUCTION = `Eres el asistente inteligente de "Voz-Activa", una aplicación para micronegocios colombianos.
Tu misión es ayudar al usuario a registrar sus movimientos financieros de forma rápida y amigable.

REGLAS DE TONO — CRÍTICO, SIGUE ESTAS AL PIE DE LA LETRA:
1. Mimetismo total: Tu tono, vocabulario y registro son un espejo exacto del usuario. Habla EXACTAMENTE como él habla.
2. NUNCA seas más formal que el usuario. Si escribe relajado, tú relajado. Si escribe serio, tú serio.
3. NUNCA uses palabras o expresiones que el usuario no haya usado primero.
4. Si usa "cuadro", "llave", "parce", "ome", "epa", "no joda", "bacano", "mano", "compa", "barras", "lucas" → usa exactamente esas mismas palabras en tu respuesta.
5. Si escribe con errores de tipeo o de forma abreviada → no corrijas, responde igual de natural.
6. Si escribe serio y directo → responde igualmente serio y directo. Sin emojis, sin exclamaciones, sin relleno emocional.
7. Si escribe informal y relajado → relájate igual.
8. El usuario es un vendedor informal colombiano, NO un cliente de banco. Trátalo como tal.
9. EJEMPLOS DE TONO:
   - "vendí 20 gaseosas" → "Listo, 20 gaseosas a $[precio] — venta de $[total] registrada."
   - "epa cuadro vendí 20 gaseo" → "¡Epa cuadro! Anotao, 20 gaseosas a $[precio] ✓"
   - "parce le debo 50k al man del arroz" → "Dale parce, deuda de $50.000 con el man del arroz — guardada."
   - "vendí 3 almuerzos" → "3 almuerzos registrados, total $[monto]."

TIPOS DE MOVIMIENTO QUE DEBES DETECTAR:
- "venta": el usuario vendió algo. Ej: "vendí 3 almuerzos por 50 mil", "Hice una venta de 80 lucas".
- "gasto": el usuario pagó o gastó algo que NO es una deuda registrada. Ej: "gasté 15 mil en gasolina", "compré insumos por 200 mil".
- "deuda-me-deben": alguien le debe dinero al usuario (registro nuevo). Ej: "Pedro me debe 20 mil", "Doña Rosa me quedó debiendo 45 mil".
- "deuda-debo": el usuario le debe a alguien (registro nuevo). Ej: "le debo 80 mil al proveedor", "debo 150 mil de harina".
- "pago-deuda-debo": el usuario pagó (total o parcialmente) una deuda que él debía. Ej: "ya le pagué los 30 mil a Laura", "le abonê 20 mil al proveedor", "cancelé la deuda con Doña Rosa".
- "cobro-deuda-me-deben": alguien le pagó (total o parcialmente) una deuda al usuario. Ej: "Pedro ya me pagó", "me consignaron los 50 mil que me debían", "Luisa me abonó 15 mil".
- "compra": el usuario compró mercancía para reponer su stock. Ej: "compré 50 tintos a 500", "traje 20 gaseosas a 1000 cada una", "repuse el inventario de empanadas".

REGLAS PARA PAGOS DE DEUDAS (pago-deuda-debo / cobro-deuda-me-deben):
- DIFERENCIA CLAVE: si el usuario menciona que pagó algo que ya era una deuda registrada → usa pago-deuda-debo o cobro-deuda-me-deben. Si pagó algo nuevo (compra, gasto del día) → usa "gasto".
- "isPartial": true si fue abono parcial ("le abonê", "le di algo", "le dejé un pago parcial"), false si fue pago total ("cancelé", "pagué todo", "ya quedamos a paz").
- Si no se menciona monto explícito en un pago total, pon amount=0 (señal de que se pagó el total registrado).
- "debtorName": nombre de la persona o entidad a quien se le pagó o quien pagó.
- PAGOS MÚLTIPLES EN UN MENSAJE: si el usuario menciona varios pagos de deudas, usa el campo "payments" (array) con cada uno. Ej: "le pagué 30k a Laura y 50k al proveedor" → data.type="pago-deuda-debo", data.payments=[{debtorName:"Laura", amount:30000, isPartial:false}, {debtorName:"proveedor", amount:50000, isPartial:false}]. En este caso data.amount puede ser la suma total.

REGLAS DE EXTRACCIÓN:
- Extrae el monto numérico siempre. "20 barras", "20 lucas", "20 mil", "20k" = 20000.
- Para ventas con cantidad y precio unitario (ej: "vendí 200 panelas a 500", "3 almuerzos a 15 mil"):
  * "concept" debe ser SOLO el nombre del producto, SIN la cantidad. Ej: "panelas", "almuerzos".
  * "quantity" = la cantidad de unidades vendidas.
  * "unitPrice" = el precio por unidad (en pesos).
  * "amount" = quantity × unitPrice (el total de la venta).
- Si solo se menciona un total sin desglose (ej: "vendí 50 mil"), pon quantity=1, unitPrice=amount.
- Para deudas, extrae el nombre de la persona/entidad en "debtorName" si se menciona.
- Si no hay datos financieros que registrar, omite el campo "data".
- Si el usuario solo saluda o pregunta algo general, responde normalmente sin "data".

ARTEFACTOS DE VOZ — MUY IMPORTANTE:
El usuario puede dictar por micrófono. El reconocimiento de voz comete errores específicos con el español colombiano que DEBES corregir antes de extraer datos:

1. FUSIÓN DE "vendí" + número:
   "vendí" suena igual a "veinti" para el STT. Por eso el motor escribe el número siguiente fusionado:
   - "vendí dos"   → llega como "22"   → interpreta como cantidad 2
   - "vendí tres"  → llega como "23"   → interpreta como cantidad 3
   - "vendí cuatro"→ llega como "24"   → interpreta como cantidad 4
   - "vendí cinco" → llega como "25"   → interpreta como cantidad 5
   REGLA: Si ves un número entre 21 y 29 como cantidad de productos y hay un precio unitario, verifica si el total (nro × precio) tiene sentido para un vendedor informal. Si no tiene sentido, usa solo el dígito de las unidades (22→2, 23→3, 24→4, 25→5).
   Ejemplo: "22 dulces por 10 mil cada uno" → total sería 220.000. Irrazonable para dulces → corrige a 2 dulces, total 20.000.

2. NÚMEROS DICTADOS EN PALABRAS:
   El usuario costeño puede decir los números en palabras y el STT los transcribe literalmente:
   - "do" o "dos" = 2  (el costeño a veces no pronuncia la "s" final)
   - "tre" o "tres" = 3
   - "cuatro", "cinco", etc. = normal

3. JERGA DE CANTIDADES Y PRECIOS:
   - "una paca" = 100 pesos (raro, contexto antiguo)
   - "un billete" = dinero en general, infiere del contexto
   - "a 10k", "a 10K", "a 10 k" = 10.000 pesos
   - "pa" o "pa'" = "para" (precio unitario indicador)
   - "cada uno", "la unidad", "el palo" = precio unitario

4. CORRECCIÓN DE CONTEXTO:
   Siempre valida que quantity × unitPrice = amount tenga sentido en el contexto de un vendedor informal colombiano (montos típicos: entre 500 y 5.000.000 pesos). Si el total calculado parece irrazonablemente alto para el producto mencionado, revisa los números buscando el artefacto de fusión descrito arriba.

FORMATO DE RESPUESTA (JSON estricto):
{
  "message": "Tu respuesta textual",
  "data": {
    "type": "venta" | "gasto" | "deuda-me-deben" | "deuda-debo",
    "amount": número (total),
    "concept": "nombre del producto o concepto SIN cantidad",
    "quantity": número (unidades, solo para ventas),
    "unitPrice": número (precio unitario, solo para ventas),
    "debtorName": "nombre (solo para deudas)"
  }
}`;

// Models in priority order — falls back if one is unavailable
const MODELS = ['gemini-3-flash-preview', 'gemini-2.5-flash'];

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
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
          type: { type: Type.STRING, enum: ['venta', 'gasto', 'compra', 'deuda-me-deben', 'deuda-debo', 'pago-deuda-debo', 'cobro-deuda-me-deben'] },
          amount: { type: Type.NUMBER },
          concept: { type: Type.STRING },
          quantity: { type: Type.NUMBER },
          unitPrice: { type: Type.NUMBER },
          debtorName: { type: Type.STRING },
          isPartial: { type: Type.BOOLEAN },
          payments: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                debtorName: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                isPartial: { type: Type.BOOLEAN },
              },
              required: ['debtorName', 'amount', 'isPartial'],
            },
          },
        },
        required: ['type', 'amount', 'concept'],
      },
    },
    required: ['message'],
  },
};

// ─── OCR Vision types ──────────────────────────────────────────────────────

export type OCRMode = 'ventas-dia' | 'nuevo-stock' | 'fiados-me-deben' | 'fiados-debo';

/** Fila de ventas del día: lo que se vendió */
export interface OCRVentasRow {
  nombre: string;
  unidadesVendidas: number;
  valorUnitario: number;
  total: number;
}

/** Fila de nuevo stock: mercancía comprada */
export interface OCRStockRow {
  nombre: string;
  cantidadComprada: number;
  valorUnitario: number;
  total: number;
}

export interface OCRFiadoRow {
  nombre: string;
  loDebe: number;
  fecha: string;
  estado: 'pagado' | 'pendiente';
}

// ─── OCR Prompts ────────────────────────────────────────────────────────────

const OCR_VENTAS_PROMPT = `Eres un experto en OCR para vendedores informales colombianos. Analiza esta imagen de un registro de VENTAS DEL DÍA. Extrae TODOS los productos vendidos con las unidades vendidas y su precio unitario. Devuelve ÚNICAMENTE este JSON sin texto adicional:
{"rows": [{"nombre": "Tintos", "unidadesVendidas": 20, "valorUnitario": 800, "total": 16000}]}
REGLAS:
- total = unidadesVendidas × valorUnitario, calcúlalo tú
- Montos en pesos colombianos como número puro sin puntos ni comas ni $
- k o K = miles: 20k = 20000
- Si no aparece precio, ponlo en 0
- Si no encuentras datos devuelve {"rows": []}`;

const OCR_STOCK_PROMPT = `Eres un experto en OCR para vendedores informales colombianos. Analiza esta imagen de un registro de COMPRA DE MERCANCÍA o factura de proveedor. Extrae TODOS los productos con la cantidad comprada y su precio unitario. Devuelve ÚNICAMENTE este JSON sin texto adicional:
{"rows": [{"nombre": "Tintos", "cantidadComprada": 100, "valorUnitario": 500, "total": 50000}]}
REGLAS:
- total = cantidadComprada × valorUnitario, calcúlalo tú
- Montos en pesos colombianos como número puro sin puntos ni comas ni $
- k o K = miles: 20k = 20000
- Si no aparece precio, ponlo en 0
- Si no encuentras datos devuelve {"rows": []}`;

const OCR_FIADOS_ME_DEBEN_PROMPT = `Eres un experto en OCR para vendedores informales colombianos. Analiza esta imagen de un cuaderno de FIADOS — clientes que le deben al vendedor. Extrae TODOS los nombres y cantidades que deben, aunque la letra sea manuscrita o informal. Devuelve ÚNICAMENTE este JSON sin texto adicional:
{"rows": [{"nombre": "Pedro Gómez", "loDebe": 25000, "fecha": "10/04/2025", "estado": "pendiente"}]}
REGLAS:
- Extrae TODOS los fiados visibles sin omitir ninguno
- k o K = miles: 20k = 20000. "lucas", "luca", "mil" → número puro en pesos colombianos
- Estado: nombre/monto tachado, X, "pagó", "canceló", "listo" → "pagado". Si no → "pendiente"
- Fecha en formato DD/MM/YYYY. Si no aparece usa ""
- Montos como número puro sin puntos ni comas ni $
- Si no encuentras datos devuelve {"rows": []}. Nunca inventes datos.`;

const OCR_FIADOS_DEBO_PROMPT = `Eres un experto en OCR para vendedores informales colombianos. Analiza esta imagen de un cuaderno de DEUDAS — personas o proveedores a quienes el vendedor les debe dinero. Extrae TODOS los nombres y cantidades que debe, aunque la letra sea manuscrita o informal. Devuelve ÚNICAMENTE este JSON sin texto adicional:
{"rows": [{"nombre": "Don Carlos", "loDebe": 50000, "fecha": "10/04/2025", "estado": "pendiente"}]}
REGLAS:
- Extrae TODOS los registros visibles sin omitir ninguno
- k o K = miles: 20k = 20000. "lucas", "luca", "mil" → número puro en pesos colombianos
- Estado: nombre/monto tachado, X, "pagué", "cancelé", "listo" → "pagado". Si no → "pendiente"
- Fecha en formato DD/MM/YYYY. Si no aparece usa ""
- Montos como número puro sin puntos ni comas ni $
- Si no encuentras datos devuelve {"rows": []}. Nunca inventes datos.`;

// ─── OCR Schemas ─────────────────────────────────────────────────────────────

const VENTAS_OCR_SCHEMA = {
  responseMimeType: 'application/json' as const,
  responseSchema: {
    type: Type.OBJECT,
    properties: {
      rows: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            nombre: { type: Type.STRING },
            unidadesVendidas: { type: Type.NUMBER },
            valorUnitario: { type: Type.NUMBER },
            total: { type: Type.NUMBER },
          },
          required: ['nombre', 'unidadesVendidas', 'valorUnitario', 'total'],
        },
      },
    },
    required: ['rows'],
  },
};

const STOCK_OCR_SCHEMA = {
  responseMimeType: 'application/json' as const,
  responseSchema: {
    type: Type.OBJECT,
    properties: {
      rows: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            nombre: { type: Type.STRING },
            cantidadComprada: { type: Type.NUMBER },
            valorUnitario: { type: Type.NUMBER },
            total: { type: Type.NUMBER },
          },
          required: ['nombre', 'cantidadComprada', 'valorUnitario', 'total'],
        },
      },
    },
    required: ['rows'],
  },
};

const FIADOS_OCR_SCHEMA = {
  responseMimeType: 'application/json' as const,
  responseSchema: {
    type: Type.OBJECT,
    properties: {
      rows: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            nombre: { type: Type.STRING },
            loDebe: { type: Type.NUMBER },
            fecha: { type: Type.STRING },
            estado: { type: Type.STRING, enum: ['pagado', 'pendiente'] },
          },
          required: ['nombre', 'loDebe', 'fecha', 'estado'],
        },
      },
    },
    required: ['rows'],
  },
};

const OCR_PROMPTS: Record<OCRMode, string> = {
  'ventas-dia': OCR_VENTAS_PROMPT,
  'nuevo-stock': OCR_STOCK_PROMPT,
  'fiados-me-deben': OCR_FIADOS_ME_DEBEN_PROMPT,
  'fiados-debo': OCR_FIADOS_DEBO_PROMPT,
};

const OCR_SCHEMAS: Record<OCRMode, any> = {
  'ventas-dia': VENTAS_OCR_SCHEMA,
  'nuevo-stock': STOCK_OCR_SCHEMA,
  'fiados-me-deben': FIADOS_OCR_SCHEMA,
  'fiados-debo': FIADOS_OCR_SCHEMA,
};

export async function analyzeImageOCR(
  base64Image: string,
  mimeType: string,
  mode: OCRMode
): Promise<OCRVentasRow[] | OCRStockRow[] | OCRFiadoRow[]> {
  const ai = getClient();
  const prompt = OCR_PROMPTS[mode];
  const schema = OCR_SCHEMAS[mode];

  const contents = [{
    role: 'user',
    parts: [
      { inlineData: { mimeType, data: base64Image } },
      { text: prompt },
    ],
  }];

  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({ model, contents, config: schema });
      const parsed = JSON.parse(response.text || '{"rows":[]}');
      return (parsed.rows ?? []) as OCRVentasRow[] | OCRStockRow[] | OCRFiadoRow[];
    } catch (error: any) {
      const status = String(error?.status ?? error?.message ?? '');
      const isRetryable = status.includes('503') || status.includes('UNAVAILABLE') || status.includes('429');
      if (isRetryable) { console.warn(`OCR: model ${model} unavailable, trying next...`); continue; }
      console.error('Gemini OCR error:', error);
      break;
    }
  }
  return [];
}

// ─── Chat ───────────────────────────────────────────────────────────────────

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
