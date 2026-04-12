import { GoogleGenAI, Type } from "@google/genai";

export interface ChatResponse {
  message: string;
  data?: {
    type: 'venta' | 'gasto' | 'deuda-me-deben' | 'deuda-debo' | 'pago-deuda-debo' | 'cobro-deuda-me-deben';
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

REGLAS DE TONO:
1. Neutro por defecto: habla de forma profesional y clara.
2. Mimetismo: Si el usuario usa lenguaje informal o costeño ("Epa", "Compadre", "No joda", "Barras", "Lucas", "Luca", "Mano", "Parce", "Bacano"), cambia a tono barranquillero. Usa "¡Epa!", "¡Ese negocio va volando!", "¡Anotado, compa!", "¡Bacano!".

TIPOS DE MOVIMIENTO QUE DEBES DETECTAR:
- "venta": el usuario vendió algo. Ej: "vendí 3 almuerzos por 50 mil", "Hice una venta de 80 lucas".
- "gasto": el usuario pagó o gastó algo que NO es una deuda registrada. Ej: "gasté 15 mil en gasolina", "compré insumos por 200 mil".
- "deuda-me-deben": alguien le debe dinero al usuario (registro nuevo). Ej: "Pedro me debe 20 mil", "Doña Rosa me quedó debiendo 45 mil".
- "deuda-debo": el usuario le debe a alguien (registro nuevo). Ej: "le debo 80 mil al proveedor", "debo 150 mil de harina".
- "pago-deuda-debo": el usuario pagó (total o parcialmente) una deuda que él debía. Ej: "ya le pagué los 30 mil a Laura", "le abonê 20 mil al proveedor", "cancelé la deuda con Doña Rosa".
- "cobro-deuda-me-deben": alguien le pagó (total o parcialmente) una deuda al usuario. Ej: "Pedro ya me pagó", "me consignaron los 50 mil que me debían", "Luisa me abonó 15 mil".

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
          type: { type: Type.STRING, enum: ['venta', 'gasto', 'deuda-me-deben', 'deuda-debo', 'pago-deuda-debo', 'cobro-deuda-me-deben'] },
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
