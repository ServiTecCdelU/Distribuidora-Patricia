"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  RefreshCw, FileText, MessageCircle, Send, Package, CheckCircle2, Loader2,
} from "lucide-react";
import { getSalesPendientesMayorista } from "@/services/sales-service";
import { getMayoristaProductos } from "@/services/mayorista-service";
import {
  crearPedidoMayorista,
  actualizarEstadoPedidoMayorista,
  getPedidosMayorista,
} from "@/services/pedidos-mayorista-service";
import type { Sale, MayoristaProducto, PedidoMayorista } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

interface ItemConsolidado {
  productoId: string;
  nombre: string;
  unidadesPedidas: number;
  unidadesPorBulto: number;
  bultosPedidos: number;
  precioMayorista: number;
}

export function PedidoMayoristaTab() {
  const [ventasPendientes, setVentasPendientes] = useState<Sale[]>([]);
  const [productosMap, setProductosMap] = useState<Map<string, MayoristaProducto>>(new Map());
  const [pedidos, setPedidos] = useState<PedidoMayorista[]>([]);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [ventas, productos, pedidosData] = await Promise.all([
        getSalesPendientesMayorista(),
        getMayoristaProductos(),
        getPedidosMayorista(),
      ]);
      setVentasPendientes(ventas);
      const map = new Map<string, MayoristaProducto>();
      productos.forEach((p) => map.set(p.id, p));
      setProductosMap(map);
      setPedidos(pedidosData);
    } catch {
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Consolidar todos los cantidadPendienteMayorista de ventas pendientes
  const itemsConsolidados = useMemo<ItemConsolidado[]>(() => {
    const acum = new Map<string, number>();
    for (const venta of ventasPendientes) {
      for (const item of (venta.items ?? []) as any[]) {
        const pendiente = item.cantidadPendienteMayorista ?? 0;
        if (pendiente <= 0) continue;
        const productoId = item.productId;
        acum.set(productoId, (acum.get(productoId) ?? 0) + pendiente);
      }
    }
    return Array.from(acum.entries()).map(([productoId, unidadesPedidas]) => {
      const prod = productosMap.get(productoId);
      const unidadesPorBulto = prod?.unidadesPorBulto ?? 1;
      return {
        productoId,
        nombre: prod?.nombre ?? productoId,
        unidadesPedidas,
        unidadesPorBulto,
        bultosPedidos: Math.ceil(unidadesPedidas / unidadesPorBulto),
        precioMayorista: prod?.precioUnitarioMayorista ?? 0,
      };
    }).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [ventasPendientes, productosMap]);

  const totalEstimado = useMemo(
    () => itemsConsolidados.reduce((acc, i) => acc + i.unidadesPedidas * i.precioMayorista, 0),
    [itemsConsolidados]
  );

  const pedidoActivo = useMemo(
    () => pedidos.find((p) => p.estado === "enviado" || p.estado === "recibido_parcial"),
    [pedidos]
  );

  const handleGenerarPedido = async () => {
    if (itemsConsolidados.length === 0) {
      toast.error("No hay productos pendientes para pedir");
      return;
    }
    setGenerando(true);
    try {
      const nuevo = await crearPedidoMayorista(
        itemsConsolidados.map((i) => ({
          productoId: i.productoId,
          nombre: i.nombre,
          unidadesPedidas: i.unidadesPedidas,
          unidadesRecibidas: 0,
          bultosPedidos: i.bultosPedidos,
        }))
      );
      setPedidos((prev) => [nuevo, ...prev]);
      toast.success("Pedido al mayorista generado");
    } catch {
      toast.error("Error al generar el pedido");
    } finally {
      setGenerando(false);
    }
  };

  const handleMarcarEnviado = async (id: string) => {
    setEnviando(id);
    try {
      await actualizarEstadoPedidoMayorista(id, "enviado");
      setPedidos((prev) => prev.map((p) => p.id === id ? { ...p, estado: "enviado" } : p));
      toast.success("Pedido marcado como enviado");
    } catch {
      toast.error("Error al actualizar el estado");
    } finally {
      setEnviando(null);
    }
  };

  const buildTextoWhatsapp = (pedido: PedidoMayorista): string => {
    const fecha = pedido.fecha.toLocaleDateString("es-AR");
    const lineas = pedido.productos.map(
      (p) => `• ${p.nombre}: ${p.bultosPedidos} bulto${p.bultosPedidos !== 1 ? "s" : ""} (${p.unidadesPedidas} uds)`
    );
    return [
      `*Pedido al mayorista — ${fecha}*`,
      "",
      ...lineas,
      "",
      `_Distribuidora Patricia_`,
    ].join("\n");
  };

  const handleWhatsapp = (pedido: PedidoMayorista) => {
    const texto = buildTextoWhatsapp(pedido);
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
  };

  const handleImprimirPdf = async (pedido: PedidoMayorista) => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF();
      const fecha = pedido.fecha.toLocaleDateString("es-AR");

      pdf.setFontSize(16);
      pdf.text("Pedido al Mayorista", 14, 20);
      pdf.setFontSize(10);
      pdf.text(`Fecha: ${fecha}`, 14, 28);
      pdf.text(`Estado: ${pedido.estado}`, 14, 34);

      // Tabla
      let y = 46;
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.text("Producto", 14, y);
      pdf.text("Uds pedidas", 120, y);
      pdf.text("Bultos", 155, y);
      y += 2;
      pdf.line(14, y, 196, y);
      y += 6;

      pdf.setFont("helvetica", "normal");
      for (const item of pedido.productos) {
        if (y > 270) {
          pdf.addPage();
          y = 20;
        }
        const nombre = item.nombre.length > 55 ? item.nombre.substring(0, 52) + "..." : item.nombre;
        pdf.text(nombre, 14, y);
        pdf.text(String(item.unidadesPedidas), 128, y);
        pdf.text(String(item.bultosPedidos), 163, y);
        y += 7;
      }

      pdf.save(`pedido-mayorista-${fecha.replace(/\//g, "-")}.pdf`);
    } catch {
      toast.error("Error al generar el PDF");
    }
  };

  const estadoLabel: Record<PedidoMayorista["estado"], string> = {
    borrador: "Borrador",
    enviado: "Enviado",
    recibido_parcial: "Recibido parcial",
    cerrado: "Cerrado",
  };
  const estadoColor: Record<PedidoMayorista["estado"], string> = {
    borrador: "bg-muted text-muted-foreground",
    enviado: "bg-blue-100 text-blue-700",
    recibido_parcial: "bg-amber-100 text-amber-700",
    cerrado: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div className="space-y-6">
      {/* Resumen pendiente */}
      <div className="rounded-2xl border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Package className="h-4 w-4 text-teal-600" />
            Pendiente de {ventasPendientes.length} venta{ventasPendientes.length !== 1 ? "s" : ""}
          </h3>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={cargar}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 rounded-lg" />)}
          </div>
        ) : itemsConsolidados.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
            No hay productos pendientes de mayorista
          </div>
        ) : (
          <>
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Producto</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Uds</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Bultos</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground hidden sm:table-cell">Precio mayorista</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {itemsConsolidados.map((item) => (
                    <tr key={item.productoId} className="hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium max-w-[180px] truncate">{item.nombre}</td>
                      <td className="px-3 py-2 text-right">{item.unidadesPedidas}</td>
                      <td className="px-3 py-2 text-right font-semibold">{item.bultosPedidos}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground hidden sm:table-cell">
                        {item.precioMayorista > 0 ? formatCurrency(item.precioMayorista) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalEstimado > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground px-1">
                <span>Total estimado</span>
                <span className="font-semibold">{formatCurrency(totalEstimado)}</span>
              </div>
            )}
            <Button
              className="w-full rounded-xl gap-2"
              onClick={handleGenerarPedido}
              disabled={generando || !!pedidoActivo}
            >
              {generando ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generando...</>
              ) : (
                <><Send className="h-4 w-4" /> Generar pedido al mayorista</>
              )}
            </Button>
            {pedidoActivo && (
              <p className="text-xs text-amber-600 text-center">
                Ya hay un pedido activo ({estadoLabel[pedidoActivo.estado]}). Cerralo antes de generar uno nuevo.
              </p>
            )}
          </>
        )}
      </div>

      {/* Historial de pedidos */}
      {pedidos.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground">Historial de pedidos</h3>
          {pedidos.map((pedido) => (
            <div key={pedido.id} className="rounded-2xl border p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm">
                    Pedido del {pedido.fecha.toLocaleDateString("es-AR")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {pedido.productos.length} producto{pedido.productos.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <Badge className={cn("text-xs", estadoColor[pedido.estado])}>
                  {estadoLabel[pedido.estado]}
                </Badge>
              </div>

              {/* Productos del pedido */}
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Producto</th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Pedidos</th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Recibidos</th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Bultos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pedido.productos.map((item) => (
                      <tr key={item.productoId} className="hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium max-w-[160px] truncate">{item.nombre}</td>
                        <td className="px-3 py-2 text-right">{item.unidadesPedidas}</td>
                        <td className={cn("px-3 py-2 text-right font-semibold",
                          item.unidadesRecibidas >= item.unidadesPedidas ? "text-emerald-600" : "text-amber-600"
                        )}>
                          {item.unidadesRecibidas}
                        </td>
                        <td className="px-3 py-2 text-right">{item.bultosPedidos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Acciones */}
              <div className="flex gap-2 flex-wrap">
                {pedido.estado === "borrador" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl gap-1.5 text-xs"
                    disabled={enviando === pedido.id}
                    onClick={() => handleMarcarEnviado(pedido.id)}
                  >
                    {enviando === pedido.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Marcar como enviado
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl gap-1.5 text-xs"
                  onClick={() => handleImprimirPdf(pedido)}
                >
                  <FileText className="h-3.5 w-3.5" />
                  PDF
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl gap-1.5 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                  onClick={() => handleWhatsapp(pedido)}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
