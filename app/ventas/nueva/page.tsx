// app/ventas/nueva/page.tsx
"use client";

import { useState, useMemo, memo, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MainLayout } from "@/components/layout/main-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Warehouse, Clock, CheckCircle2 } from "lucide-react";
import {
  Search,
  Plus,
  ShoppingCart,
  Loader2,
  CheckCircle,
  ArrowLeft,
  FileText,
  Receipt,
  Package,
  X,
  Eye,
  EyeOff,
  List,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { useCart } from "@/hooks/useCart";
import type { UserRole } from "@/hooks/useCart";
import { UnifiedCart } from "@/components/cart/UnifiedCart";
import { useAuth } from "@/hooks/use-auth";

// ─── Wrapper: espera auth antes de montar el carrito ──────────────────────────
function NuevaVentaInner() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  const cartRole: UserRole = user?.role === "seller" ? "seller" : "admin";
  return <NuevaVentaContent cartRole={cartRole} userEmail={user?.email} employeeType={user?.employeeType} />;
}

export default function NuevaVentaPage() {
  return (
    <Suspense fallback={
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    }>
      <NuevaVentaInner />
    </Suspense>
  );
}

// ─── Contenido: role estable, nunca cambia después del mount ──────────────────
function NuevaVentaContent({
  cartRole,
  userEmail,
  employeeType,
}: {
  cartRole: UserRole;
  userEmail?: string;
  employeeType?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, actions } = useCart(cartRole, userEmail);

  const [searchQuery, setSearchQuery] = useState("");
  const [showDisabled, setShowDisabled] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [cartDialogOpen, setCartDialogOpen] = useState(false);
  const [mayoristaDialogOpen, setMayoristaDialogOpen] = useState(false);

  // Abrir carrito automáticamente si viene desde tienda (?openCart=true)
  useEffect(() => {
    if (searchParams.get("openCart") === "true" && state.cart.length > 0) {
      setCartDialogOpen(true);
    }
  }, [searchParams, state.cart.length]);

  const { enabledProducts, disabledProducts } = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const enabled: typeof state.products = [];
    const disabled: typeof state.products = [];
    for (const product of state.products) {
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query);
      if (!matchesSearch) continue;
      if ((product as any).disabled) {
        if (showDisabled) disabled.push(product);
      } else {
        enabled.push(product);
      }
    }
    return { enabledProducts: enabled, disabledProducts: disabled };
  }, [state.products, searchQuery, showDisabled]);

  const filteredProducts = enabledProducts.length + disabledProducts.length > 0;

  const handleConfirmSale = async (modo: "esperar" | "disponible") => {
    setMayoristaDialogOpen(false);
    const result = await actions.processSale(modo);
    if (result === "order") {
      // Transportistas y "ambos" tienen acceso a pedidos; vendedores puros no
      const canSeePedidos = employeeType === "transportista" || employeeType === "ambos";
      router.push(canSeePedidos ? "/pedidos" : "/ventas");
    }
  };

  if (state.processing) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
            <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center shadow-lg">
              <Loader2 className="h-10 w-10 text-white animate-spin" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-foreground">Procesando venta...</h2>
            <p className="text-sm text-muted-foreground">Esto puede tardar unos segundos</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (state.saleComplete) {
    return (
      <MainLayout>
        <div className="flex flex-col min-h-[80vh]">
          <div className="mb-4">
            <Button
              variant="ghost" size="sm"
              onClick={() => router.push("/ventas")}
              className="gap-2 text-sm h-9"
            >
              <ArrowLeft className="h-4 w-4" /> Volver
            </Button>
          </div>

          <div className="flex-1 flex items-center justify-center px-4">
            <Card className="w-full max-w-md border-2 shadow-xl">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="flex justify-center mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping" />
                    <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg">
                      <CheckCircle className="h-10 w-10 text-white" />
                    </div>
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-center mb-2">Venta Exitosa!</h2>
                <p className="text-sm text-muted-foreground text-center mb-6">
                  La venta se proceso correctamente
                </p>

                <div className="rounded-xl bg-gradient-to-br from-muted/30 to-muted/10 p-4 mb-5 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground font-medium">Total</span>
                    <span className="text-2xl font-bold text-foreground">
                      {actions.formatCurrency(state.finalTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Forma de pago</span>
                    <Badge
                      variant={state.paymentType === "cash" ? "default" : state.paymentType === "credit" ? "secondary" : "outline"}
                      className="text-xs font-medium"
                    >
                      {state.paymentType === "cash" ? "Contado" : state.paymentType === "credit" ? "A Cuenta" : "Mixto"}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <Button variant="outline" className="h-10 text-sm gap-2" onClick={() => router.push(`/ventas?saleId=${state.lastSaleId}`)}>
                      <FileText className="h-4 w-4" /> Boleta
                    </Button>
                    <Button variant="outline" className="h-10 text-sm gap-2" onClick={() => router.push(`/ventas?saleId=${state.lastSaleId}`)}>
                      <Receipt className="h-4 w-4" /> Remito
                    </Button>
                  </div>
                  <Button variant="outline" className="w-full h-10 text-sm gap-2" onClick={() => router.push("/ventas")}>
                    <Eye className="h-4 w-4" /> Mis Ventas
                  </Button>
                  <Button className="w-full h-10 text-sm gap-2 shadow-md" onClick={actions.resetCart}>
                    <Plus className="h-4 w-4" /> Nueva Venta
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Nueva Venta" description="Registra una nueva venta">
      <div className="space-y-4 pb-24 lg:pb-4">
        <PageHeader
          description={
            state.deliveryMethod === "delivery"
              ? "Crear pedido para envio a domicilio"
              : "Registra una venta en mostrador"
          }
          stackOnMobile
          actions={
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card">
                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Deshabilitados</span>
                <Switch checked={showDisabled} onCheckedChange={setShowDisabled} className="scale-75" />
              </div>
              <div className="flex items-center gap-1 border border-border rounded-lg p-0.5">
                <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={() => setViewMode("grid")}>
                  <LayoutGrid className="h-3.5 w-3.5" />
                </Button>
                <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={() => setViewMode("list")}>
                  <List className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          }
        />

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar productos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 h-11 text-sm rounded-xl border-2 focus-visible:ring-2"
          />
          {searchQuery && (
            <Button variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearchQuery("")}>
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {state.loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-52 rounded-xl" />
            ))}
          </div>
        ) : !filteredProducts ? (
          <div className="text-center py-16">
            <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Package className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">No se encontraron productos</h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery ? `No hay productos que coincidan con "${searchQuery}"` : "No hay productos disponibles"}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {enabledProducts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <div className="h-1 flex-1 bg-gradient-to-r from-primary/20 to-transparent rounded" />
                  <span>Habilitados</span>
                  <div className="h-1 flex-1 bg-gradient-to-l from-primary/20 to-transparent rounded" />
                </h3>
                <ProductGrid products={enabledProducts} cart={state.cart} addToCart={actions.addToCart} formatCurrency={actions.formatCurrency} viewMode={viewMode} />
              </div>
            )}
            {showDisabled && disabledProducts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <div className="h-1 flex-1 bg-gradient-to-r from-muted-foreground/20 to-transparent rounded" />
                  <span>Deshabilitados</span>
                  <div className="h-1 flex-1 bg-gradient-to-l from-muted-foreground/20 to-transparent rounded" />
                </h3>
                <ProductGrid products={disabledProducts} cart={state.cart} addToCart={actions.addToCart} formatCurrency={actions.formatCurrency} disabled viewMode={viewMode} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cart FAB */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          size="lg"
          className={cn(
            "h-16 w-16 rounded-full shadow-2xl transition-all duration-300 relative",
            state.cart.length > 0 ? "bg-primary hover:bg-primary/90 scale-100" : "bg-muted/50 scale-90 opacity-50",
          )}
          onClick={() => setCartDialogOpen(true)}
          disabled={state.cart.length === 0}
        >
          <ShoppingCart className="h-7 w-7 text-white" />
          {state.cart.length > 0 && (
            <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[11px] font-bold ring-2 ring-background">
              {state.cartCount}
            </div>
          )}
        </Button>
      </div>

      {/* Cart Dialog */}
      <Dialog open={cartDialogOpen} onOpenChange={setCartDialogOpen}>
        <DialogContent
          className="max-w-sm sm:max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto p-0 gap-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="px-4 sm:px-5 py-3 sm:py-4 border-b border-border bg-muted/30">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Carrito
              {state.cart.length > 0 && (
                <Badge variant="secondary" className="text-xs">{state.cartCount} items</Badge>
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">Revisa y gestiona los productos en tu carrito</DialogDescription>
          </DialogHeader>
          <div className="px-4 sm:px-5 py-3 sm:py-4">
            <UnifiedCart
              role={cartRole}
              state={state}
              actions={actions}
              onConfirmSale={() => { setCartDialogOpen(false); setMayoristaDialogOpen(true); }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de opciones mayorista */}
      <MayoristaOptionsDialog
        open={mayoristaDialogOpen}
        onOpenChange={setMayoristaDialogOpen}
        cart={state.cart}
        total={state.finalTotal}
        formatCurrency={actions.formatCurrency}
        processing={state.processing}
        onConfirm={handleConfirmSale}
      />
    </MainLayout>
  );
}

// ─── Dialog de opciones mayorista ────────────────────────────────────────────
import type { Product, CartItem } from "@/lib/types";

function MayoristaOptionsDialog({
  open, onOpenChange, cart, total, formatCurrency, processing, onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cart: CartItem[];
  total: number;
  formatCurrency: (n: number) => string;
  processing: boolean;
  onConfirm: (modo: "esperar" | "disponible") => void;
}) {
  const hayPendiente = cart.some((item) => {
    const stockLocal = item.product.stockLocal ?? 0;
    return item.quantity > stockLocal;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-teal-600" />
            Confirmar venta
          </DialogTitle>
          <DialogDescription className="sr-only">Elegí cómo procesar esta venta</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Resumen de ítems */}
          <div className="rounded-xl border divide-y text-sm">
            {cart.map((item) => {
              const stockLocal = item.product.stockLocal ?? 0;
              const local = Math.min(item.quantity, stockLocal);
              const pendiente = Math.max(0, item.quantity - stockLocal);
              return (
                <div key={item.product.id} className="flex items-center justify-between px-3 py-2 gap-2">
                  <span className="flex-1 truncate font-medium text-xs">{item.product.name}</span>
                  <div className="flex items-center gap-2 text-xs shrink-0">
                    <span className="text-emerald-600">local: {local}</span>
                    {pendiente > 0 && (
                      <span className="text-amber-600">mayorista: {pendiente}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between items-center px-1 text-sm font-semibold">
            <span className="text-muted-foreground">Total</span>
            <span className="text-lg text-teal-600">{formatCurrency(total)}</span>
          </div>

          {/* Opciones */}
          {hayPendiente ? (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => onConfirm("esperar")}
                disabled={processing}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-amber-300 bg-amber-50/50 hover:bg-amber-50 transition-colors disabled:opacity-50 text-left"
              >
                <Clock className="h-6 w-6 text-amber-600" />
                <div>
                  <p className="font-semibold text-sm text-amber-800">Esperar todo</p>
                  <p className="text-xs text-amber-700/70 mt-0.5">Queda pendiente hasta que llegue el stock</p>
                </div>
              </button>
              <button
                onClick={() => onConfirm("disponible")}
                disabled={processing}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-teal-300 bg-teal-50/50 hover:bg-teal-50 transition-colors disabled:opacity-50 text-left"
              >
                <CheckCircle2 className="h-6 w-6 text-teal-600" />
                <div>
                  <p className="font-semibold text-sm text-teal-800">Vender con lo que hay</p>
                  <p className="text-xs text-teal-700/70 mt-0.5">Confirma con stock local, el resto se cancela</p>
                </div>
              </button>
            </div>
          ) : (
            <div className="pt-1">
              <button
                onClick={() => onConfirm("disponible")}
                disabled={processing}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl border-2 border-teal-300 bg-teal-50/50 hover:bg-teal-50 transition-colors disabled:opacity-50 font-semibold text-teal-800"
              >
                <CheckCircle2 className="h-5 w-5 text-teal-600" />
                {processing ? "Procesando..." : "Confirmar venta"}
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-componentes de productos ─────────────────────────────────────────────

const LOGO_FALLBACK = "/logo.png";

function getImageSrc(imageUrl?: string): string {
  if (!imageUrl) return LOGO_FALLBACK;
  if (imageUrl.startsWith("http")) return imageUrl;
  return LOGO_FALLBACK;
}

const ProductCard = memo(function ProductCard({
  product, quantity, onAdd, formatCurrency, disabled,
}: {
  product: Product;
  quantity: number;
  onAdd: (p: Product) => void;
  formatCurrency: (n: number) => string;
  disabled?: boolean;
}) {
  const esMayorista = product.stockLocal !== undefined;
  const stockDisplay = esMayorista ? (product.stockLocal ?? 0) : product.stock;
  return (
    <Card
      className={cn(
        "group cursor-pointer transition-all duration-200 hover:shadow-lg border-2 overflow-hidden",
        disabled && "opacity-60 border-dashed",
        quantity > 0 ? "border-primary ring-2 ring-primary/20 shadow-md" : "border-transparent hover:border-border",
      )}
      onClick={() => onAdd(product)}
    >
      <CardContent className="p-0">
        <div className="relative aspect-square overflow-hidden bg-muted">
          <img
            src={getImageSrc(product.imageUrl)}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full transition-transform duration-500 group-hover:scale-110 object-contain p-4 opacity-40"
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              if (img.src !== window.location.origin + LOGO_FALLBACK) {
                img.src = LOGO_FALLBACK;
              }
            }}
          />
          {disabled && (
            <div className="absolute top-2 left-2">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-background/80 backdrop-blur">
                <EyeOff className="h-2.5 w-2.5 mr-0.5" /> Oculto
              </Badge>
            </div>
          )}
          {quantity > 0 && (
            <div className="absolute top-2 right-2 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shadow-lg ring-2 ring-background">
              {quantity}
            </div>
          )}
          {esMayorista && stockDisplay === 0 && (
            <Badge variant="outline" className="absolute bottom-2 left-2 text-[10px] py-0 px-2 shadow-md border-amber-400 text-amber-700 bg-amber-50">
              Sin stock local
            </Badge>
          )}
        </div>
        <div className="p-2">
          <h3 className="font-medium text-xs text-foreground line-clamp-3 mb-1.5 min-h-[3rem] leading-tight">
            {product.name}
          </h3>
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm text-primary">{formatCurrency(product.price)}</span>
            <span className={cn("text-[10px] font-medium", stockDisplay === 0 ? "text-amber-600" : "text-muted-foreground")}>
              {esMayorista ? `local: ${stockDisplay}` : `${stockDisplay} uds`}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

const ProductListItem = memo(function ProductListItem({
  product, quantity, onAdd, formatCurrency, disabled,
}: {
  product: Product;
  quantity: number;
  onAdd: (p: Product) => void;
  formatCurrency: (n: number) => string;
  disabled?: boolean;
}) {
  const esMayorista = product.stockLocal !== undefined;
  const stockDisplay = esMayorista ? (product.stockLocal ?? 0) : product.stock;
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all hover:bg-muted/40",
        disabled && "opacity-60",
        quantity > 0 ? "border-primary bg-primary/5" : "border-border",
      )}
      onClick={() => onAdd(product)}
    >
      <img
        src="/logo.png"
        alt={product.name}
        className="w-10 h-10 rounded-md object-contain p-1 shrink-0 border border-border/30 opacity-40"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{product.name}</p>
        <p className="text-xs text-muted-foreground">
          {esMayorista ? `local: ${stockDisplay}` : `${stockDisplay} uds`} · {formatCurrency(product.price)}
        </p>
      </div>
      {quantity > 0 && (
        <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
          {quantity}
        </span>
      )}
    </div>
  );
});

function ProductGrid({
  products, cart, addToCart, formatCurrency, disabled = false, viewMode = "grid",
}: {
  products: Product[];
  cart: CartItem[];
  addToCart: (p: Product) => void;
  formatCurrency: (n: number) => string;
  disabled?: boolean;
  viewMode?: "grid" | "list";
}) {
  const cartMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of cart) map.set(item.product.id, item.quantity);
    return map;
  }, [cart]);

  if (viewMode === "list") {
    return (
      <div className="space-y-1">
        {products.map((product) => (
          <ProductListItem
            key={product.id}
            product={product}
            quantity={cartMap.get(product.id) || 0}
            onAdd={addToCart}
            formatCurrency={formatCurrency}
            disabled={disabled}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          quantity={cartMap.get(product.id) || 0}
          onAdd={addToCart}
          formatCurrency={formatCurrency}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
