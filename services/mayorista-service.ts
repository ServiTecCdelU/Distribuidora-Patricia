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
import { createProduct, updateProduct } from "@/services/products-service";

const COL = "mayorista_productos";
const PREFS_COL = "configuracion";

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
    stockLocal: (data.stockLocal as number) ?? 0,
    habilitado: (data.habilitado as boolean) ?? false,
    lote: data.lote as number | undefined,
    seDivideEn: data.seDivideEn as number | undefined,
    productoId: data.productoId as string | undefined,
    updatedAt: toDate(data.updatedAt),
  };
}

export const getMayoristaProductos = async (): Promise<MayoristaProducto[]> => {
  const snap = await getDocs(collection(firestore, COL));
  return snap.docs
    .map((d) => mapDoc(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
};

// Batch size conservador para no saturar el rate limit de Firestore
const BATCH_SIZE = 200;

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
};

export const updateMayoristaProducto = async (
  id: string,
  updates: Partial<Pick<MayoristaProducto, "categoria" | "precioVenta" | "gananciaGlobal" | "stockLocal">>
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
  for (const chunk of chunks) {
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
  const stock = Math.floor(lote / seDivideEn);
  const precio = precioVentaOverride ?? mp.precioVenta;

  let productoId = mp.productoId;

  if (productoId) {
    await updateProduct(productoId, { stock, price: precio });
  } else {
    const created = await createProduct({
      name: mp.nombre,
      description: mp.codigo,
      price: precio,
      stock,
      imageUrl: "",
      category: mp.rubro || mp.categoria || "Sin categoría",
      codigo: mp.codigo,
      unidadesPorBulto: seDivideEn,
      stockLocal: stock,
    });
    productoId = created.id;
  }

  await updateDoc(doc(firestore, COL, mp.id), {
    habilitado: true,
    lote,
    seDivideEn,
    productoId,
    updatedAt: serverTimestamp(),
  });
};

export const deshabilitarProducto = async (id: string): Promise<void> => {
  await updateDoc(doc(firestore, COL, id), {
    habilitado: false,
    updatedAt: serverTimestamp(),
  });
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
