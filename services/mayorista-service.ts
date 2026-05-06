import {
  collection,
  doc,
  getDocs,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import type { MayoristaProducto, MayoristaPrefs } from "@/lib/types";
import { toDate } from "@/services/firestore-helpers";

const COL = "mayorista_productos";
const PRODUCTS_COLLECTION = "productos";
const PREFS_COL = "configuracion";

// ─── Caché persistente (localStorage + memoria) ───────────────────────────────
// Persiste entre recargas de página para no gastar lecturas de Firestore (50K/día).
// TTL de 2 horas. Se invalida manualmente tras importar o forzar recarga.
const CACHE_KEY = "mayorista_cache_v1";
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 horas

let _memCache: { data: MayoristaProducto[]; ts: number } | null = null;

function readCache(): { data: MayoristaProducto[]; ts: number } | null {
  if (_memCache) return _memCache;
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: MayoristaProducto[]; ts: number };
    if (!parsed?.ts || !Array.isArray(parsed.data)) return null;
    _memCache = parsed;
    return _memCache;
  } catch {
    return null;
  }
}

function writeCache(data: MayoristaProducto[]): void {
  _memCache = { data, ts: Date.now() };
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(_memCache));
  } catch {
    // localStorage puede estar lleno — el caché en memoria sigue activo
  }
}

export const invalidateMayoristaCache = () => {
  _memCache = null;
  if (typeof window !== "undefined") {
    try { localStorage.removeItem(CACHE_KEY); } catch { /* noop */ }
  }
};

function mapDoc(id: string, data: Record<string, unknown>): MayoristaProducto {
  return {
    id,
    codigoBarras: (data.codigoBarras as string) ?? "",
    codigo: (data.codigo as string) ?? "",
    nombre: (data.nombre as string) ?? "",
    precioUnitarioMayorista: (data.precioUnitarioMayorista as number) ?? 0,
    rubro: (data.rubro as string) ?? "",
    subrubro: (data.subrubro as string) ?? "",
    unidadesPorBulto: (data.unidadesPorBulto as number) ?? 1,
    categoria: (data.categoria as string) ?? "Sin categoría",
    precioVenta: (data.precioVenta as number) ?? 0,
    gananciaGlobal: data.gananciaGlobal as number | undefined,
    gananciaIndividual: (data.gananciaIndividual as boolean) ?? false,
    stockLocal: (data.stockLocal as number) ?? 0,
    habilitado: (data.habilitado as boolean) ?? false,
    lote: data.lote as number | undefined,
    seDivideEn: data.seDivideEn as number | undefined,
    productoId: data.productoId as string | undefined,
    updatedAt: toDate(data.updatedAt),
  };
}

export const getMayoristaProductos = async (forceRefresh = false): Promise<MayoristaProducto[]> => {
  if (!forceRefresh) {
    const cached = readCache();
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return cached.data;
    }
  }
  const snap = await getDocs(collection(firestore, COL));
  const data = snap.docs
    .map((d) => mapDoc(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  writeCache(data);
  return data;
};

const BATCH_SIZE = 300;
const PARALLEL_BATCHES = 2; // 2 x 300 = 600 writes concurrentes, dentro del límite

export const upsertMayoristaProductos = async (
  productos: Omit<MayoristaProducto, "id" | "updatedAt" | "stockLocal" | "precioVenta" | "gananciaGlobal" | "habilitado" | "lote" | "seDivideEn" | "productoId">[],
  onProgress?: (done: number, total: number) => void
): Promise<void> => {
  // Pre-lectura para detectar cambios y solo escribir los productos que cambiaron.
  // Trades reads (50K/día) por writes (20K/día) — mucho más eficiente para importaciones diarias.
  onProgress?.(0, productos.length);
  const snap = await getDocs(collection(firestore, COL));
  const existingMap = new Map<string, Record<string, unknown>>();
  snap.docs.forEach((d) => existingMap.set(d.id, d.data() as Record<string, unknown>));

  const toWrite = productos.filter((p) => {
    const id = `mp_${p.codigo.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const ex = existingMap.get(id);
    if (!ex) return true; // nuevo producto
    return (
      ex.nombre !== p.nombre ||
      ex.precioUnitarioMayorista !== p.precioUnitarioMayorista ||
      ex.codigoBarras !== (p.codigoBarras ?? "") ||
      ex.rubro !== (p.rubro ?? "") ||
      ex.subrubro !== (p.subrubro ?? "")
    );
  });

  if (toWrite.length === 0) {
    onProgress?.(productos.length, productos.length);
    return;
  }

  const chunks: typeof toWrite[] = [];
  for (let i = 0; i < toWrite.length; i += BATCH_SIZE) {
    chunks.push(toWrite.slice(i, i + BATCH_SIZE));
  }

  let done = 0;

  for (const chunk of chunks) {
    const batch = writeBatch(firestore);
    for (const p of chunk) {
      const id = `mp_${p.codigo.replace(/[^a-zA-Z0-9]/g, "_")}`;
      batch.set(
        doc(firestore, COL, id),
        {
          codigoBarras: p.codigoBarras ?? "",
          codigo: p.codigo,
          nombre: p.nombre,
          precioUnitarioMayorista: p.precioUnitarioMayorista,
          rubro: p.rubro ?? "",
          subrubro: p.subrubro ?? "",
          unidadesPorBulto: p.unidadesPorBulto,
          categoria: p.categoria,
          updatedAt: serverTimestamp(),
        },
        { merge: true } // preserva precioVenta, habilitado, lote, etc.
      );
    }
    await batch.commit();
    done += chunk.length;
    // Progreso relativo al total original (no solo los que cambiaron)
    onProgress?.(Math.round((done / toWrite.length) * productos.length), productos.length);
  }
  onProgress?.(productos.length, productos.length);

  // Reconstruir el caché con los datos que ya tenemos en memoria,
  // aplicando los cambios escritos. Evita una lectura extra de Firestore.
  const updatedMap = new Map(existingMap);
  for (const p of toWrite) {
    const id = `mp_${p.codigo.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const existing = existingMap.get(id) ?? {};
    updatedMap.set(id, {
      ...existing,
      codigoBarras: p.codigoBarras ?? "",
      codigo: p.codigo,
      nombre: p.nombre,
      precioUnitarioMayorista: p.precioUnitarioMayorista,
      rubro: p.rubro ?? "",
      subrubro: p.subrubro ?? "",
      unidadesPorBulto: p.unidadesPorBulto,
      categoria: p.categoria,
      updatedAt: new Date(),
    });
  }
  const updatedData = Array.from(updatedMap.entries())
    .map(([id, data]) => mapDoc(id, data))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  writeCache(updatedData);
};

export const updateMayoristaProducto = async (
  id: string,
  updates: Partial<Pick<MayoristaProducto, "categoria" | "precioVenta" | "gananciaGlobal" | "gananciaIndividual" | "stockLocal" | "lote" | "seDivideEn">>
): Promise<void> => {
  await updateDoc(doc(firestore, COL, id), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

// Aplica un porcentaje a una lista de productos ya cargados en memoria (sin re-leer Firestore).
// Usa batches paralelos para máxima velocidad.
export const applyGananciaToProducts = async (
  porcentaje: number,
  products: Array<{ id: string; precioUnitarioMayorista: number }>,
  onProgress?: (done: number, total: number) => void
): Promise<void> => {
  const chunks: typeof products[] = [];
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    chunks.push(products.slice(i, i + BATCH_SIZE));
  }

  let done = 0;
  for (let i = 0; i < chunks.length; i += PARALLEL_BATCHES) {
    const group = chunks.slice(i, i + PARALLEL_BATCHES);
    await Promise.all(
      group.map(async (chunk) => {
        const batch = writeBatch(firestore);
        chunk.forEach(({ id, precioUnitarioMayorista }) => {
          const precioVenta = Math.round(precioUnitarioMayorista * (1 + porcentaje / 100) * 100) / 100;
          batch.update(doc(firestore, COL, id), {
            precioVenta,
            gananciaGlobal: porcentaje,
            updatedAt: serverTimestamp(),
          });
        });
        await batch.commit();
        done += chunk.length;
        onProgress?.(done, products.length);
      })
    );
  }

  // Actualizar caché local con los nuevos precios de venta (sin leer Firestore)
  const cached = readCache();
  if (cached) {
    const updateMap = new Map(products.map((p) => [p.id, p.precioUnitarioMayorista]));
    const updated = cached.data.map((p) => {
      if (!updateMap.has(p.id)) return p;
      return {
        ...p,
        precioVenta: Math.round(updateMap.get(p.id)! * (1 + porcentaje / 100) * 100) / 100,
        gananciaGlobal: porcentaje,
      };
    });
    writeCache(updated);
  }
};

// Mantiene compatibilidad (lee de Firestore, útil si no hay productos en memoria)
export const applyGananciaGlobal = async (porcentaje: number): Promise<void> => {
  const snap = await getDocs(collection(firestore, COL));
  const products = snap.docs.map((d) => ({
    id: d.id,
    precioUnitarioMayorista: (d.data().precioUnitarioMayorista as number) ?? 0,
  }));
  await applyGananciaToProducts(porcentaje, products);
};

// ─── Habilitar / Deshabilitar ─────────────────────────────────────────────────

export const habilitarProducto = async (
  mp: MayoristaProducto,
  lote: number,
  seDivideEn: number,
  precioVentaOverride?: number
): Promise<void> => {
  const precio = precioVentaOverride ?? mp.precioVenta;

  let productoId = mp.productoId;

  if (productoId) {
    // Solo actualizar precio y asegurar que esté habilitado — el stock se gestiona aparte
    await updateDoc(doc(firestore, PRODUCTS_COLLECTION, productoId), {
      price: precio,
      disabled: false,
    });
  } else {
    // ID determinístico basado en el código del mayorista, sin loop de lecturas
    productoId = `prod_${mp.id}`;
    await setDoc(doc(firestore, PRODUCTS_COLLECTION, productoId), {
      name: mp.nombre,
      description: mp.codigo,
      price: precio,
      stock: 0,
      imageUrl: "",
      category: mp.rubro || mp.categoria || "Sin categoría",
      disabled: false,
      createdAt: serverTimestamp(),
    });
  }

  await updateDoc(doc(firestore, COL, mp.id), {
    habilitado: true,
    lote,
    seDivideEn,
    productoId,
    precioVenta: precio,
    updatedAt: serverTimestamp(),
  });

  // Actualizar caché local para que el refresh no revierta el estado
  const cached = readCache();
  if (cached) {
    const updated = cached.data.map((p) =>
      p.id === mp.id
        ? { ...p, habilitado: true, lote, seDivideEn, productoId, precioVenta: precio, updatedAt: new Date() }
        : p
    );
    writeCache(updated);
  }
};

export const deshabilitarProducto = async (mp: MayoristaProducto): Promise<void> => {
  await updateDoc(doc(firestore, COL, mp.id), {
    habilitado: false,
    updatedAt: serverTimestamp(),
  });

  // Deshabilitar en la colección productos.
  // Usar productoId guardado; si no existe, derivar el ID determinístico (prod_<mp.id>).
  const productoId = mp.productoId ?? `prod_${mp.id}`;
  try {
    await updateDoc(doc(firestore, PRODUCTS_COLLECTION, productoId), {
      disabled: true,
    });
  } catch { /* si el doc no existe, ignorar */ }

  // Actualizar caché local
  const cached = readCache();
  if (cached) {
    const updated = cached.data.map((p) =>
      p.id === mp.id ? { ...p, habilitado: false, updatedAt: new Date() } : p
    );
    writeCache(updated);
  }
};

// ─── Preferencias de columnas (por usuario) ───────────────────────────────────

const PREFS_DEFAULTS: MayoristaPrefs = {
  showCodigoBarras: true,
  showRubro: true,
  showSubrubro: true,
};

export const getMayoristaPrefs = async (userId: string): Promise<MayoristaPrefs> => {
  const snap = await getDoc(doc(firestore, PREFS_COL, `${userId}_mayorista_prefs`));
  if (!snap.exists()) return { ...PREFS_DEFAULTS };
  const data = snap.data();
  return {
    showCodigoBarras: data.showCodigoBarras ?? true,
    showRubro: data.showRubro ?? true,
    showSubrubro: data.showSubrubro ?? true,
  };
};

export const saveMayoristaPrefs = async (
  userId: string,
  prefs: MayoristaPrefs
): Promise<void> => {
  await setDoc(doc(firestore, PREFS_COL, `${userId}_mayorista_prefs`), prefs);
};
