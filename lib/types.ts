// lib/types.ts
export type UserRole = "admin" | "seller" | "customer";
export type EmployeeType = "vendedor" | "transportista" | "ambos";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  sellerId?: string;
  employeeType?: EmployeeType;
  isActive: boolean;
  createdAt: Date;
}

export type InvoiceStatus = "pending" | "generated" | "sent_whatsapp";

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  imageUrl: string;
  category: string;
  createdAt: Date;
  // Campos mayorista (solo cuando el producto viene de mayorista_productos)
  stockLocal?: number;
  unidadesPorBulto?: number;
  codigo?: string;
}

export interface Client {
  id: string;
  name: string;
  dni?: string;
  cuit: string;
  email: string;
  phone: string;
  address: string;
  addresses?: Array<{ city: string; address: string; lat?: number; lng?: number }>;
  taxCategory:
    | "responsable_inscripto"
    | "monotributo"
    | "consumidor_final"
    | "exento"
    | "no_responsable";
  creditLimit: number;
  currentBalance: number;
  createdAt: Date;
}

export interface Transaction {
  id: string;
  clientId: string;
  type: "debt" | "payment";
  amount: number;
  description: string;
  date: Date;
  saleId?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  itemDiscount?: number; // porcentaje 0-30
  cantidadStockLocal?: number;
  cantidadPendienteMayorista?: number;
}

export interface Sale {
  id: string;
  saleNumber?: string;
  clientId?: string;
  clientName?: string;
  clientPhone?: string;
  clientCuit?: string;
  clientDni?: string;
  clientEmail?: string;
  clientAddress?: string;
  clientTaxCategory?: Client["taxCategory"];
  sellerId?: string;
  sellerName?: string;
  source?: "direct" | "order";
  items: { productId: string; quantity: number; price: number; name: string; itemDiscount?: number }[];
  total: number;
  paymentType: "cash" | "credit" | "mixed";
  paymentMethod?: "efectivo" | "transferencia";
  cashAmount?: number;
  creditAmount?: number;
  status: "completed" | "pending" | "listo" | "pendiente";
  invoiceNumber?: string;
  remitoNumber?: string;
  invoiceEmitted: boolean;
  invoiceStatus?: InvoiceStatus;
  invoicePdfUrl?: string;
  invoiceWhatsappUrl?: string;
  remitoPdfUrl?: string;
  discount?: number;
  discountType?: "percent" | "fixed";
  orderId?: string;
  deliveryMethod?: "pickup" | "delivery";
  deliveryAddress?: string;
  createdAt: Date;
  invoiceDriveUrl?: string;
  invoiceDriveFileId?: string;
  remitoDriveUrl?: string;
  remitoDriveFileId?: string;
}

export type City = "Concepcion del Uruguay" | "Colon" | "Gualeguaychu" | "San Salvador";

export const CITIES: City[] = ["Concepcion del Uruguay", "Colon", "Gualeguaychu", "San Salvador"];

export interface Order {
  id: string;
  saleId?: string;
  clientId?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  sellerId?: string;
  sellerName?: string;
  transportistaId?: string;
  transportistaName?: string;
  items: { productId: string; quantity: number; name: string; price: number; itemDiscount?: number }[];
  status: "pending" | "preparation" | "delivery" | "completed";
  city?: City;
  address: string;
  lat?: number;
  lng?: number;
  deliveryMethod?: "pickup" | "delivery";
  remitoNumber?: string;
  remitoPdfBase64?: string;
  invoiceNumber?: string;
  invoicePdfBase64?: string;
  checkedItems?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type OrderStatus = "pending" | "preparation" | "delivery" | "completed";

export interface Seller {
  id: string;
  name: string;
  email: string;
  phone: string;
  employeeType: EmployeeType;
  commissionRate: number;
  transportistaCommissionRate?: number;
  isActive: boolean;
  totalSales: number;
  totalCommission: number;
  createdAt: Date;
}

export type AuditAction =
  | "sale_created"
  | "sale_invoiced"
  | "product_created"
  | "product_updated"
  | "product_deleted"
  | "client_created"
  | "client_updated"
  | "client_deleted"
  | "order_created"
  | "order_status_changed"
  | "cash_register_opened"
  | "cash_register_closed"
  | "payment_registered"
  | "price_list_updated";

export interface AuditEntry {
  id: string;
  action: AuditAction;
  userId: string;
  userName: string;
  description: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export type PriceListType = "general" | "mayorista" | "especial";

export interface PriceList {
  id: string;
  name: string;
  type: PriceListType;
  description: string;
  // Multiplier: 1 = same price, 0.9 = 10% off, 1.1 = 10% markup
  multiplier: number;
  isActive: boolean;
  createdAt: Date;
}

export interface MayoristaProducto {
  id: string;
  codigo: string;
  nombre: string;
  precioUnitarioMayorista: number;
  unidadesPorBulto: number;
  categoria: string;
  precioVenta: number;
  gananciaGlobal?: number;
  stockLocal: number;
  updatedAt: Date;
}

export interface StockMovimiento {
  id: string;
  productoId: string;
  tipo: "apertura_bulto" | "venta" | "ajuste";
  cantidad: number;
  referencia?: string;
  fecha: Date;
}

export interface PedidoMayorista {
  id: string;
  fecha: Date;
  estado: "borrador" | "enviado" | "recibido_parcial" | "cerrado";
  productos: {
    productoId: string;
    nombre: string;
    unidadesPedidas: number;
    unidadesRecibidas: number;
    bultosPedidos: number;
  }[];
}

export interface SellerCommission {
  id: string;
  sellerId: string;
  saleId: string;
  saleNumber?: string;
  clientName?: string;
  saleTotal: number;
  commissionRate: number;
  commissionAmount: number;
  isPaid: boolean;
  paidAt?: Date;
  createdAt: Date;
}
