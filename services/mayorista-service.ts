import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import type { MayoristaProducto } from "@/lib/types";
import { toDate } from "@/services/firestore-helpers";

const COL = "mayorista_productos";

function mapDoc(id: string, data: Record<string, unknown>): MayoristaProducto {
  return {
    id,
    codigo: (data.codigo as string) ?? "",
    nombre: (data.nombre as string) ?? "",
    precioUnitarioMayorista: (data.precioUnitarioMayorista as number) ?? 0,
    unidadesPorBulto: (data.unidadesPorBulto as number) ?? 1,
    categoria: (data.categoria as string) ?? "Sin categoría",
    precioVenta: (data.precioVenta as number) ?? 0,
    gananciaGlobal: data.gananciaGlobal as number | undefined,
    stockLocal: (data.stockLocal as number) ?? 0,
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
  productos: Omit<MayoristaProducto, "id" | "updatedAt" | "stockLocal" | "precioVenta" | "gananciaGlobal">[]
): Promise<void> => {
  // Leer existentes para preservar precioVenta, gananciaGlobal y stockLocal
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
        codigo: p.codigo,
        nombre: p.nombre,
        precioUnitarioMayorista: p.precioUnitarioMayorista,
        unidadesPorBulto: p.unidadesPorBulto,
        categoria: p.categoria,
        // Preservar campos que no vienen del Excel
        precioVenta: prev?.precioVenta ?? 0,
        gananciaGlobal: prev?.gananciaGlobal ?? null,
        stockLocal: prev?.stockLocal ?? 0,
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
