"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPrice, formatDateFull } from "@/lib/utils/format";
import type { Order, OrderStatus, Seller } from "@/lib/types";
import {
  X,
  User,
  MapPin,
  Calendar,
  Box,
  CheckCircle,
  ChevronRight,
  ArrowRight,
  Clock,
  Truck,
  FileText,
  Download,
  Send,
  Loader2,
  UserCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { statusConfig, statusFlow } from "@/lib/order-constants";
import { descargarDocumento, enviarWhatsapp } from "@/lib/utils/doc-actions";
import { toast } from "sonner";

const generateOrderNumber = (createdAt: Date | string) => {
  const date = new Date(createdAt);
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}${month}${day}`;
};


const calculateOrderTotal = (order: Order) => {
  const itemsTotal = order.items.reduce((acc, item) => {
    const base = item.price * item.quantity;
    const dto = item.itemDiscount ? (base * item.itemDiscount) / 100 : 0;
    return acc + base - dto;
  }, 0);
  if (order.discount && order.discount > 0) {
    const discountAmt = order.discountType === "percent"
      ? (itemsTotal * order.discount) / 100
      : order.discount;
    return Math.max(0, itemsTotal - discountAmt);
  }
  return itemsTotal;
};

interface OrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onStatusChange: (orderId: string, newStatus: OrderStatus) => void;
  onGenerateRemito?: (order: Order) => Promise<void>;
  onGenerateInvoice?: (order: Order) => Promise<void>;
  onAssignTransportista?: (orderId: string, transportistaId: string, transportistaName: string) => void;
  onRemoveTransportista?: (orderId: string) => void;
  sellers?: Seller[];
  generatingDoc?: boolean;
  userRole?: string;
}

export function OrderDetailModal({
  isOpen,
  onClose,
  order,
  onStatusChange,
  onGenerateRemito,
  onGenerateInvoice,
  onAssignTransportista,
  onRemoveTransportista,
  sellers = [],
  userRole,
}: OrderDetailModalProps) {
  const router = useRouter();
  const [selectedTransportista, setSelectedTransportista] = useState<string>("");
  const [showTransportistaSelect, setShowTransportistaSelect] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [downloading, setDownloading] = useState<"invoice" | "remito" | null>(null);

  if (!order) return null;

  const config = statusConfig[order.status] || {
    label: order.status || "Desconocido",
    color: "text-gray-700",
    dotColor: "bg-gray-500",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
  };

  const getNextStatus = (currentStatus: OrderStatus): OrderStatus | null => {
    const currentIndex = statusFlow.indexOf(currentStatus);
    if (currentIndex < statusFlow.length - 1) return statusFlow[currentIndex + 1];
    return null;
  };

  const nextStatus = getNextStatus(order.status);
  const transportistas = sellers.filter(
    (s) => s.employeeType === "transportista" || s.employeeType === "ambos"
  );

  const handleAssign = () => {
    if (!selectedTransportista || !onAssignTransportista) return;
    const t = transportistas.find((s) => s.id === selectedTransportista);
    if (t) {
      onAssignTransportista(order.id, t.id, t.name);
      setShowTransportistaSelect(false);
      setSelectedTransportista("");
    }
  };

  const handleDescargar = (type: "invoice" | "remito") => {
    setDownloading(type);
    const base64 = type === "invoice" ? order.invoicePdfBase64 : order.remitoPdfBase64;
    const tipo = type === "invoice" ? "boleta" as const : "remito" as const;
    const numero = type === "invoice" ? order.invoiceNumber : order.remitoNumber;
    descargarDocumento(base64, tipo, numero, order.clientName);
    setDownloading(null);
  };

  const handleWhatsapp = async (type: "invoice" | "remito") => {
    const base64 = type === "invoice" ? order.invoicePdfBase64 : order.remitoPdfBase64;
    const tipo = type === "invoice" ? "boleta" as const : "remito" as const;
    const numero = type === "invoice" ? order.invoiceNumber : order.remitoNumber;
    await enviarWhatsapp(base64, tipo, numero, order.clientName);
  };

  const handleGenerarRemito = async () => {
    if (!onGenerateRemito) return;
    setGenerando(true);
    try {
      await onGenerateRemito(order);
    } finally {
      setGenerando(false);
    }
  };

  const handleGenerarFactura = async () => {
    if (!onGenerateInvoice) return;
    setGenerando(true);
    try {
      await onGenerateInvoice(order);
    } finally {
      setGenerando(false);
    }
  };

  const hasRemito = !!order.remitoNumber;
  const hasInvoice = !!order.invoiceNumber;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl w-[calc(100vw-1rem)] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b shrink-0">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-base sm:text-xl flex items-center gap-2 sm:gap-3 min-w-0">
              <span className="font-mono truncate">#{generateOrderNumber(order.createdAt)}</span>
              <div className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 rounded-full ${config.bgColor} border ${config.borderColor} shrink-0`}>
                <div className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
                <span className={`text-xs font-semibold ${config.color}`}>{config.label}</span>
              </div>
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 rounded-full shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Completed banner */}
          {order.status === "completed" && order.saleId && (
            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-800 mb-1">Pedido completado con venta</p>
                  <Button
                    variant="outline"
                    className="w-full border-green-300 text-green-700 hover:bg-green-100 bg-white mt-2"
                    onClick={() => router.push(`/ventas?saleId=${order.saleId}`)}
                  >
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Ver Venta y Documentos completos
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Transportista (admin only) */}
          {userRole === "admin" && (
            <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-orange-700 uppercase font-semibold flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5" />
                  Transportista
                </Label>
                {order.transportistaName && onRemoveTransportista && (
                  <button onClick={() => onRemoveTransportista(order.id)} className="text-xs text-red-500 hover:text-red-700">
                    Quitar
                  </button>
                )}
              </div>
              {order.transportistaName ? (
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-orange-200 flex items-center justify-center">
                    <UserCheck className="h-4 w-4 text-orange-700" />
                  </div>
                  <span className="font-medium text-gray-900">{order.transportistaName}</span>
                  <button className="ml-auto text-xs text-orange-600 hover:underline" onClick={() => setShowTransportistaSelect(true)}>
                    Cambiar
                  </button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="w-full border-orange-300 text-orange-700 bg-white hover:bg-orange-50 gap-2"
                  onClick={() => setShowTransportistaSelect(true)}>
                  <UserCheck className="h-4 w-4" />
                  Asignar Transportista
                </Button>
              )}
              {showTransportistaSelect && (
                <div className="space-y-2 pt-1">
                  <Select value={selectedTransportista} onValueChange={setSelectedTransportista}>
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {transportistas.length === 0
                        ? <SelectItem value="none" disabled>Sin transportistas</SelectItem>
                        : transportistas.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)
                      }
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={handleAssign} disabled={!selectedTransportista}>Asignar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowTransportistaSelect(false)}><X className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 sm:p-4 bg-gray-50 rounded-xl border border-gray-100">
              <Label className="text-xs text-gray-500 uppercase flex items-center gap-1.5 mb-2">
                <User className="h-3.5 w-3.5" />
                Cliente
              </Label>
              <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                {order.clientName || <span className="text-gray-400 italic">Venta directa</span>}
              </p>
            </div>
            <div className="p-3 sm:p-4 bg-gray-50 rounded-xl border border-gray-100">
              <Label className="text-xs text-gray-500 uppercase mb-2 block">Vendedor</Label>
              <p className="font-semibold text-gray-900 text-sm sm:text-base">{order.sellerName || "Sin asignar"}</p>
            </div>
          </div>

          <div className="space-y-2 sm:space-y-3">
            {order.city && (
              <div className="p-3 sm:p-4 bg-gray-50 rounded-xl border border-gray-100">
                <Label className="text-xs text-gray-500 uppercase flex items-center gap-1.5 mb-1.5 sm:mb-2">
                  <Truck className="h-3.5 w-3.5" />
                  Ciudad
                </Label>
                <p className="text-gray-900 font-medium text-sm sm:text-base">{order.city}</p>
              </div>
            )}
            <div className="p-3 sm:p-4 bg-gray-50 rounded-xl border border-gray-100">
              <Label className="text-xs text-gray-500 uppercase flex items-center gap-1.5 mb-1.5 sm:mb-2">
                <MapPin className="h-3.5 w-3.5" />
                Dirección
              </Label>
              <p className="text-gray-900 font-medium text-sm sm:text-base break-words">{order.address}</p>
            </div>
            <div className="p-3 sm:p-4 bg-gray-50 rounded-xl border border-gray-100">
              <Label className="text-xs text-gray-500 uppercase flex items-center gap-1.5 mb-1.5 sm:mb-2">
                <Calendar className="h-3.5 w-3.5" />
                Fecha
              </Label>
              <p className="text-gray-900 font-medium text-sm sm:text-base">{formatDateFull(order.createdAt)}</p>
            </div>
          </div>

          {/* Productos */}
          <div>
            <Label className="text-xs text-gray-500 uppercase flex items-center gap-1.5 mb-3">
              <Box className="h-3.5 w-3.5" />
              Productos ({order.items.length})
            </Label>
            <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
              {order.items.map((item, index) => {
                const base = item.price * item.quantity;
                const dto = item.itemDiscount ?? 0;
                const precioConDto = item.price * (1 - dto / 100);
                const subtotal = precioConDto * item.quantity;
                return (
                  <div key={index} className="flex justify-between items-center py-3 px-4 border-b last:border-0 hover:bg-gray-100/50 transition-colors gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900 block truncate">{item.name}</span>
                      <span className="text-xs text-gray-500">
                        {dto > 0
                          ? <><s>{formatPrice(item.price)}</s> → {formatPrice(precioConDto)} c/u <span className="text-emerald-600 font-medium">(-{dto}%)</span></>
                          : <>{formatPrice(item.price)} c/u</>
                        }
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant="secondary" className="font-mono block mb-0.5">x{item.quantity}</Badge>
                      <span className="text-xs font-semibold text-gray-900">{formatPrice(subtotal)}</span>
                    </div>
                  </div>
                );
              })}
              {/* Subtotales y descuentos */}
              {(() => {
                const subtotalBruto = order.items.reduce((acc, i) => acc + i.price * i.quantity, 0);
                const subtotalConItemDtos = order.items.reduce((acc, i) => {
                  const base = i.price * i.quantity;
                  const dto = i.itemDiscount ? (base * i.itemDiscount) / 100 : 0;
                  return acc + base - dto;
                }, 0);
                const hayItemDtos = subtotalBruto > subtotalConItemDtos;
                const generalDiscount = (order as any).discount ?? 0;
                const generalDiscountType = (order as any).discountType;
                const generalDiscountAmt = generalDiscount > 0
                  ? (generalDiscountType === "percent" ? (subtotalConItemDtos * generalDiscount) / 100 : generalDiscount)
                  : 0;
                const total = Math.max(0, subtotalConItemDtos - generalDiscountAmt);
                return (
                  <div className="py-2 px-4 bg-gray-100/50 border-t space-y-1">
                    {(hayItemDtos || generalDiscountAmt > 0) && (
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>Subtotal</span>
                        <span>{formatPrice(subtotalBruto)}</span>
                      </div>
                    )}
                    {hayItemDtos && (
                      <div className="flex justify-between items-center text-xs text-emerald-600">
                        <span>Dto. por producto</span>
                        <span>-{formatPrice(subtotalBruto - subtotalConItemDtos)}</span>
                      </div>
                    )}
                    {generalDiscountAmt > 0 && (
                      <div className="flex justify-between items-center text-xs text-emerald-600">
                        <span>Dto. general {generalDiscountType === "percent" ? `(${generalDiscount}%)` : ""}</span>
                        <span>-{formatPrice(generalDiscountAmt)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-1 border-t border-gray-200">
                      <span className="text-sm font-semibold text-gray-700">Total</span>
                      <span className="font-bold text-gray-900">{formatPrice(total)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Progreso */}
          <div>
            <Label className="text-xs text-gray-500 uppercase mb-4 block">Progreso del pedido</Label>
            <div className="space-y-0">
              {statusFlow.map((status, index) => {
                const isCompleted = statusFlow.indexOf(order.status) >= index;
                const isCurrent = order.status === status;
                const stepConfig = statusConfig[status];
                return (
                  <div key={status} className="flex items-start gap-4 relative">
                    {index < statusFlow.length - 1 && (
                      <div className={`absolute left-4 top-8 w-0.5 h-8 ${isCompleted ? "bg-green-500" : "bg-gray-200"}`} />
                    )}
                    <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 flex-shrink-0 ${
                      isCompleted ? `${stepConfig.dotColor} border-transparent`
                        : isCurrent ? `bg-white ${stepConfig.color.replace("text-", "border-")}`
                        : "bg-white border-gray-300"
                    }`}>
                      {isCompleted
                        ? <CheckCircle className="h-4 w-4 text-white" />
                        : <div className={`w-2 h-2 rounded-full ${isCurrent ? stepConfig.dotColor : "bg-gray-300"}`} />
                      }
                    </div>
                    <div className="flex-1 pb-6">
                      <p className={`text-sm font-semibold ${isCompleted || isCurrent ? "text-gray-900" : "text-gray-400"}`}>
                        {stepConfig.label}
                      </p>
                      {isCurrent && <p className="text-xs text-gray-500 mt-0.5">Estado actual</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Botón avanzar */}
          {nextStatus && (
            <Button
              className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-shadow"
              size="lg"
              onClick={() => onStatusChange(order.id, nextStatus)}
            >
              {nextStatus === "completed" ? (
                <>Completar Pedido y Cobrar<ChevronRight className="h-5 w-5 ml-2" /></>
              ) : (
                <>Avanzar a {statusConfig[nextStatus].label}<ChevronRight className="h-5 w-5 ml-2" /></>
              )}
            </Button>
          )}

          {/* ── Documentos — 2 boxes (mismo UX que ventas) ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
            {/* Boleta */}
            <div className={`p-4 rounded-xl border ${hasInvoice ? "bg-emerald-50/50 border-emerald-200" : "bg-muted/50 border-border"}`}>
              <div className="flex items-center gap-2 mb-2">
                <FileText className={`h-4 w-4 ${hasInvoice ? "text-emerald-600" : "text-muted-foreground"}`} />
                <span className="text-xs font-medium text-muted-foreground">Boleta</span>
                {hasInvoice && <CheckCircle className="h-3.5 w-3.5 text-emerald-500 ml-auto" />}
              </div>
              <p className={`font-semibold text-sm ${hasInvoice ? "text-emerald-700" : "text-muted-foreground"}`}>
                {hasInvoice ? order.invoiceNumber : "Sin boleta"}
              </p>

              {hasInvoice ? (
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs"
                    disabled={downloading === "invoice"} onClick={() => handleDescargar("invoice")}>
                    {downloading === "invoice" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                    PDF
                  </Button>
                  <Button size="sm" className="flex-1 gap-1 text-xs bg-green-500 hover:bg-green-600 text-white"
                    onClick={() => handleWhatsapp("invoice")}>
                    <Send className="h-3 w-3" />
                    WhatsApp
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs mt-3"
                  onClick={handleGenerarFactura} disabled={generando || !onGenerateInvoice}>
                  {generando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                  Generar Factura
                </Button>
              )}
            </div>

            {/* Remito */}
            <div className={`p-4 rounded-xl border ${hasRemito ? "bg-blue-50/50 border-blue-200" : "bg-muted/50 border-border"}`}>
              <div className="flex items-center gap-2 mb-2">
                <Truck className={`h-4 w-4 ${hasRemito ? "text-blue-600" : "text-muted-foreground"}`} />
                <span className="text-xs font-medium text-muted-foreground">Remito</span>
                {hasRemito && <CheckCircle className="h-3.5 w-3.5 text-blue-500 ml-auto" />}
              </div>
              <p className={`font-semibold text-sm ${hasRemito ? "text-blue-700" : "text-muted-foreground"}`}>
                {hasRemito ? order.remitoNumber : "Sin remito"}
              </p>

              {hasRemito ? (
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs"
                    disabled={downloading === "remito"} onClick={() => handleDescargar("remito")}>
                    {downloading === "remito" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                    PDF
                  </Button>
                  <Button size="sm" className="flex-1 gap-1 text-xs bg-green-500 hover:bg-green-600 text-white"
                    onClick={() => handleWhatsapp("remito")}>
                    <Send className="h-3 w-3" />
                    WhatsApp
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs mt-3"
                  onClick={handleGenerarRemito} disabled={generando || !onGenerateRemito}>
                  {generando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
                  Generar Remito
                </Button>
              )}
            </div>
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
