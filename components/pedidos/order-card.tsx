//components/pedidos/order-card.tsx
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice, formatDateTime as formatDate } from "@/lib/utils/format";
import type { Order } from "@/lib/types";
import { Eye, User, Box, CheckCircle, MapPin } from "lucide-react";
import { statusConfig, statusFlow } from "@/lib/order-constants"; //

const generateOrderNumber = (createdAt: Date | string, index: number) => {
  const date = new Date(createdAt);
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const orderNum = (index + 1).toString().padStart(4, "0");
  return `${year}${month}${day}-${orderNum}`;
};

interface OrderCardProps {
  order: Order;
  index: number;
  totalOrders: number;
  variant: "table" | "card";
  onViewDetails: () => void;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export function OrderCard({
  order,
  index,
  totalOrders,
  variant,
  onViewDetails,
  isSelected,
  onToggleSelect,
}: OrderCardProps) {
  const config = statusConfig[order.status] || {
    label: order.status || "Desconocido",
    color: "text-gray-700",
    dotColor: "bg-gray-500",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
  };
  const isCompleted = order.status === "completed";
  const orderNumber = generateOrderNumber(
    order.createdAt,
    totalOrders - 1 - index,
  );

  if (variant === "table") {
    return (
      <tr className="hover:bg-gray-50/80 transition-colors group">
        {onToggleSelect && (
          <td className="px-3 py-4 w-8">
            <input
              type="checkbox"
              checked={!!isSelected}
              onChange={onToggleSelect}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 rounded border-gray-300 accent-teal-600 cursor-pointer"
            />
          </td>
        )}
        <td className="px-4 py-4">
          <div>
            <p className="font-bold text-gray-900 font-mono text-sm">
              #{orderNumber}
            </p>
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
              {formatDate(order.createdAt)}
            </p>
            {isCompleted && order.saleId && (
              <p className="text-xs text-green-600 mt-1 font-medium flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Venta: {order.saleId.slice(-6)}
              </p>
            )}
          </div>
        </td>
        <td className="px-4 py-4">
          <p className="text-sm font-semibold text-gray-900">
            {order.clientName || (
              <span className="text-gray-400 italic">Venta directa</span>
            )}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {order.sellerName || "Sin vendedor"}
          </p>
        </td>
        <td className="px-4 py-4">
          <p className="text-sm text-gray-700 truncate max-w-[200px]">
            {order.address && order.address !== "Retiro en local" ? order.address : (
              <span className="text-gray-400 italic">Retiro en local</span>
            )}
          </p>
        </td>
        <td className="px-4 py-4">
          <div className="flex items-center gap-2">
            <Box className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-700">
              {order.items.length}{" "}
              {order.items.length === 1 ? "producto" : "productos"}
            </span>
          </div>
        </td>
        <td className="px-4 py-4">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bgColor} border ${config.borderColor}`}
          >
            <div
              className={`w-2 h-2 rounded-full ${config.dotColor} animate-pulse`}
            />
            <span className={`text-sm font-semibold ${config.color}`}>
              {config.label}
            </span>
          </div>
        </td>
        <td className="px-4 py-4 text-right">
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewDetails}
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-2 group-hover:bg-blue-50/50"
          >
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">Ver detalles</span>
          </Button>
        </td>
      </tr>
    );
  }

  return (
    <Card className="overflow-hidden border-gray-200 hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-bold text-gray-900 font-mono text-sm">
              #{orderNumber}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {formatDate(order.createdAt)}
            </p>
          </div>
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bgColor} border ${config.borderColor}`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
            <span className={`text-xs font-semibold ${config.color}`}>
              {config.label}
            </span>
          </div>
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={!!isSelected}
              onChange={onToggleSelect}
              onClick={(e) => e.stopPropagation()}
              className="h-5 w-5 rounded border-gray-300 accent-teal-600 cursor-pointer ml-2"
            />
          )}
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="font-medium text-gray-900 truncate">
              {order.clientName || "Venta directa"}
            </span>
          </div>
          {order.address && order.address !== "Retiro en local" && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="text-gray-600 truncate">{order.address}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Box className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-gray-600">
              {order.items.length}{" "}
              {order.items.length === 1 ? "producto" : "productos"}
            </span>
          </div>
          {isCompleted && order.saleId && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium">
                Venta: {order.saleId.slice(-6)}
              </span>
            </div>
          )}
        </div>

        <Button
          variant="outline"
          className="w-full border-gray-300 hover:bg-gray-50 hover:border-gray-400"
          onClick={onViewDetails}
        >
          <Eye className="h-4 w-4 mr-2 text-blue-600" />
          Ver detalles
        </Button>
      </CardContent>
    </Card>
  );
}
