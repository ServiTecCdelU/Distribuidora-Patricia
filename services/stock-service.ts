import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  serverTimestamp,
  updateDoc,
  increment,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import type { StockMovimiento } from "@/lib/types";
import { toDate } from "@/services/firestore-helpers";

const MOV_COL = "stock_movimientos";
const PROD_COL = "mayorista_productos";

function mapMovimiento(id: string, data: Record<string, unknown>): StockMovimiento {
  return {
    id,
    productoId: (data.productoId as string) ?? "",
    tipo: (data.tipo as StockMovimiento["tipo"]) ?? "ajuste",
    cantidad: (data.cantidad as number) ?? 0,
    referencia: data.referencia as string | undefined,
    fecha: toDate(data.fecha),
  };
}

export const getMovimientosByProducto = async (productoId: string): Promise<StockMovimiento[]> => {
  const q = query(
    collection(firestore, MOV_COL),
    where("productoId", "==", productoId),
    orderBy("fecha", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapMovimiento(d.id, d.data() as Record<string, unknown>));
};

/**
 * Registra un movimiento de stock Y actualiza el campo stockLocal del producto.
 * cantidad positiva = entrada (apertura_bulto), negativa = salida (venta).
 */
export const registrarMovimiento = async (params: {
  productoId: string;
  tipo: StockMovimiento["tipo"];
  cantidad: number;
  referencia?: string;
}): Promise<void> => {
  const { productoId, tipo, cantidad, referencia } = params;

  // Registrar movimiento
  await addDoc(collection(firestore, MOV_COL), {
    productoId,
    tipo,
    cantidad,
    referencia: referencia ?? null,
    fecha: serverTimestamp(),
  });

  // Actualizar stockLocal en el producto
  await updateDoc(doc(firestore, PROD_COL, productoId), {
    stockLocal: increment(cantidad),
    updatedAt: serverTimestamp(),
  });
};

/**
 * Descuenta stock de múltiples productos en una misma operación (venta).
 */
export const descontarStockVenta = async (
  items: { productoId: string; cantidad: number }[],
  ventaId: string
): Promise<void> => {
  await Promise.all(
    items.map((item) =>
      registrarMovimiento({
        productoId: item.productoId,
        tipo: "venta",
        cantidad: -item.cantidad,
        referencia: ventaId,
      })
    )
  );
};
