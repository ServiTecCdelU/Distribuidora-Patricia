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

export const upsertMayoristaProductos = async (
  productos: Omit<MayoristaProducto, "id" | "updatedAt" | "stockLocal" | "precioVenta" | "gananciaGlobal" | "habilitado" | "lote" | "seDivideEn" | "productoId">[]
): Promise<void> => {
  // Leer existentes para preservar campos que no vienen del Excel
  const snap = await getDocs(collection(firestore, COL));
  const existing = new Map<string, Record<string, unknown>>();
  snap.docs.forEach((d) => existing.set(d.id, d.data() as Record<string, unknown>));

  const batch = writeBatch(firestore);
  for (const p of productos) {
    const id = `mp_${p.codigo.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const prev = existing.get(id);
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
        // Preservar campos que no vienen del Excel
        precioVenta: prev?.precioVenta ?? 0,
        gananciaGlobal: prev?.gananciaGlobal ?? null,
        stockLocal: prev?.stockLocal ?? 0,
        habilitado: prev?.habilitado ?? false,
        lote: prev?.lote ?? null,
        seDivideEn: prev?.seDivideEn ?? null,
        productoId: prev?.productoId ?? null,
        updatedAt: serverTimestamp(),
      },
      { merge: false }
    );
  }
  await batch.commit();
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

export const applyGananciaGlobal = async (porcentaje: number): Promise<void> => {
  const snap = await getDocs(collection(firestore, COL));
  const batch = writeBatch(firestore);
  snap.docs.forEach((d) => {
    const data = d.data() as Record<string, unknown>;
    const precioVenta =
      Math.round(((data.precioUnitarioMayorista as number) ?? 0) * (1 + porcentaje / 100) * 100) / 100;
    batch.update(doc(firestore, COL, d.id), {
      precioVenta,
      gananciaGlobal: porcentaje,
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
};

// ─── Habilitar / Deshabilitar ─────────────────────────────────────────────────

export const habilitarProducto = async (
  mp: MayoristaProducto,
  lote: number,
  seDivideEn: number
): Promise<void> => {
  const stock = Math.floor(lote / seDivideEn);

  let productoId = mp.productoId;

  if (productoId) {
    await updateProduct(productoId, { stock, price: mp.precioVenta });
  } else {
    const created = await createProduct({
      name: mp.nombre,
      description: mp.codigo,
      price: mp.precioVenta,
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
