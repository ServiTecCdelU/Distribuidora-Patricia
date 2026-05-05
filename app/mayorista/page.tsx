"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Upload,
  Search,
  X,
  FileSpreadsheet,
  Percent,
  Pencil,
  Check,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  PackagePlus,
  PackageX,
  Settings2,
} from "lucide-react";
import * as XLSX from "xlsx";
import type { MayoristaProducto, MayoristaPrefs } from "@/lib/types";
import {
  getMayoristaProductos,
  upsertMayoristaProductos,
  updateMayoristaProducto,
  applyGananciaGlobal,
  habilitarProducto,
  deshabilitarProducto,
  getMayoristaPrefs,
  saveMayoristaPrefs,
} from "@/services/mayorista-service";
import { formatCurrency } from "@/lib/utils/format";
import { useAuth } from "@/hooks/use-auth";

// ─── Tipos internos ───────────────────────────────────────────────────────────
type ColumnLetter = string;

interface ExcelColumn {
  letter: ColumnLetter;
  header: string;
  preview: string[];
}

interface ColumnMapping {
  codigoBarras: ColumnLetter;
  codigo: ColumnLetter;
  nombre: ColumnLetter;
  precioUnitario: ColumnLetter;
  rubro: ColumnLetter;
  subrubro: ColumnLetter;
  unidadesPorBulto: ColumnLetter;
}

interface ParsedRow {
  codigoBarras: string;
  codigo: string;
  nombre: string;
  precioUnitarioMayorista: number;
  rubro: string;
  subrubro: string;
  unidadesPorBulto: number;
  categoria: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function colIndexToLetter(index: number): string {
  let letter = "";
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

function cellToString(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

function cellToNumber(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function getSubrubros(subrubro: string): [string, string, string] {
  const parts = subrubro.split("/").map((s) => s.trim());
  return [parts[0] ?? "", parts[1] ?? "", parts[2] ?? ""];
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function MayoristaPage() {
  const { user } = useAuth();
  const [productos, setProductos] = useState<MayoristaProducto[]>([]);
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<MayoristaPrefs>({
    showCodigoBarras: true,
    showRubro: true,
    showSubrubro: true,
  });
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const data = await getMayoristaProductos();
      setProductos(data);
    } catch {
      toast.error("Error al cargar productos del mayorista");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!user) return;
    getMayoristaPrefs(user.id)
      .then((p) => {
        setPrefs(p);
        setPrefsLoaded(true);
      })
      .catch(() => setPrefsLoaded(true));
  }, [user]);

  const handlePrefsChange = async (newPrefs: MayoristaPrefs) => {
    setPrefs(newPrefs);
    if (!user) return;
    try {
      await saveMayoristaPrefs(user.id, newPrefs);
    } catch {
      toast.error("Error al guardar preferencias");
    }
  };

  return (
    <MainLayout title="Mayorista" description="Gestión de productos y precios del mayorista">
      <div className="space-y-4">
        <PageHeader description="Productos y precios del mayorista" />

        {/* Panel de preferencias de columnas */}
        {prefsLoaded && (
          <Card className="rounded-2xl border-dashed">
            <CardContent className="py-3 px-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Settings2 className="h-3.5 w-3.5" />
                  <span className="font-medium">Columnas visibles:</span>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="show-codbar"
                    checked={prefs.showCodigoBarras}
                    onCheckedChange={(v) =>
                      handlePrefsChange({ ...prefs, showCodigoBarras: !!v })
                    }
                  />
                  <Label htmlFor="show-codbar" className="text-xs cursor-pointer">
                    Código de barras
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="show-rubro"
                    checked={prefs.showRubro}
                    onCheckedChange={(v) =>
                      handlePrefsChange({ ...prefs, showRubro: !!v })
                    }
                  />
                  <Label htmlFor="show-rubro" className="text-xs cursor-pointer">
                    Rubro
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="show-subrubro"
                    checked={prefs.showSubrubro}
                    onCheckedChange={(v) =>
                      handlePrefsChange({ ...prefs, showSubrubro: !!v })
                    }
                  />
                  <Label htmlFor="show-subrubro" className="text-xs cursor-pointer">
                    Subrubros
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="lista">
          <TabsList className="rounded-xl">
            <TabsTrigger value="lista" className="rounded-lg">Lista de precios</TabsTrigger>
            <TabsTrigger value="precios" className="rounded-lg">Precios de venta</TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="mt-4">
            <ListaPrecios
              productos={productos}
              loading={loading}
              prefs={prefs}
              onReload={cargar}
              onProductosImportados={(nuevos) => setProductos(nuevos)}
              onCategoriaChange={(id, cat) =>
                setProductos((prev) =>
                  prev.map((p) => (p.id === id ? { ...p, categoria: cat } : p))
                )
              }
              onHabilitarChange={(id, changes) =>
                setProductos((prev) =>
                  prev.map((p) => (p.id === id ? { ...p, ...changes } : p))
                )
              }
            />
          </TabsContent>

          <TabsContent value="precios" className="mt-4">
            <PreciosVenta
              productos={productos}
              loading={loading}
              onPrecioChange={(id, precio) =>
                setProductos((prev) =>
                  prev.map((p) => (p.id === id ? { ...p, precioVenta: precio } : p))
                )
              }
              onGananciaGlobalApplied={(porc) =>
                setProductos((prev) =>
                  prev.map((p) => ({
                    ...p,
                    precioVenta:
                      Math.round(p.precioUnitarioMayorista * (1 + porc / 100) * 100) / 100,
                    gananciaGlobal: porc,
                  }))
                )
              }
            />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

// ─── Tab 1: Lista de precios ──────────────────────────────────────────────────
function ListaPrecios({
  productos,
  loading,
  prefs,
  onReload,
  onProductosImportados,
  onCategoriaChange,
  onHabilitarChange,
}: {
  productos: MayoristaProducto[];
  loading: boolean;
  prefs: MayoristaPrefs;
  onReload: () => void;
  onProductosImportados: (nuevos: MayoristaProducto[]) => void;
  onCategoriaChange: (id: string, cat: string) => void;
  onHabilitarChange: (id: string, changes: Partial<MayoristaProducto>) => void;
}) {
  const PAGE_SIZE = 100;
  const [search, setSearch] = useState("");
  const [rubroFiltro, setRubroFiltro] = useState("todos");
  const [subrubroFiltro, setSubrubroFiltro] = useState("todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [importOpen, setImportOpen] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<string | null>(null);
  const [categoriaInput, setCategoriaInput] = useState("");
  const [habilitarTarget, setHabilitarTarget] = useState<MayoristaProducto | null>(null);

  // Reset página cuando cambian filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [search, rubroFiltro, subrubroFiltro]);

  const rubros = useMemo(() => {
    const set = new Set(productos.map((p) => p.rubro).filter(Boolean));
    return ["todos", ...Array.from(set as Set<string>).sort()];
  }, [productos]);

  const subrubros = useMemo(() => {
    const set = new Set<string>();
    productos.forEach((p) => {
      if (!p.subrubro) return;
      if (rubroFiltro !== "todos" && p.rubro !== rubroFiltro) return;
      const [s1] = getSubrubros(p.subrubro);
      if (s1) set.add(s1);
    });
    return ["todos", ...Array.from(set).sort()];
  }, [productos, rubroFiltro]);

  const filtrados = useMemo(() => {
    const q = search.toLowerCase();
    return productos.filter((p) => {
      const matchSearch =
        !q ||
        p.nombre.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q) ||
        (p.codigoBarras ?? "").includes(q);
      const matchRubro = rubroFiltro === "todos" || p.rubro === rubroFiltro;
      const matchSub =
        subrubroFiltro === "todos" ||
        (p.subrubro ? getSubrubros(p.subrubro)[0] === subrubroFiltro : false);
      return matchSearch && matchRubro && matchSub;
    });
  }, [productos, search, rubroFiltro, subrubroFiltro]);

  // Con filtros activos: mostrar todos los resultados sin paginar
  const hayFiltros = search || rubroFiltro !== "todos" || subrubroFiltro !== "todos";
  const totalPages = hayFiltros ? 1 : Math.ceil(filtrados.length / PAGE_SIZE);
  const filasPagina = hayFiltros
    ? filtrados
    : filtrados.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const guardarCategoria = async (id: string) => {
    const cat = categoriaInput.trim();
    if (!cat) return;
    try {
      await updateMayoristaProducto(id, { categoria: cat });
      onCategoriaChange(id, cat);
      setEditingCategoria(null);
      toast.success("Categoría actualizada");
    } catch {
      toast.error("Error al guardar la categoría");
    }
  };

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, código o cód. barras..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl"
          />
          {search && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => setSearch("")}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <Select value={rubroFiltro} onValueChange={(v) => { setRubroFiltro(v); setSubrubroFiltro("todos"); }}>
          <SelectTrigger className="w-full sm:w-48 rounded-xl">
            <SelectValue placeholder="Rubro" />
          </SelectTrigger>
          <SelectContent>
            {rubros.map((r) => (
              <SelectItem key={r} value={r}>
                {r === "todos" ? "Todos los rubros" : r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={subrubroFiltro} onValueChange={setSubrubroFiltro}>
          <SelectTrigger className="w-full sm:w-48 rounded-xl">
            <SelectValue placeholder="Subrubro" />
          </SelectTrigger>
          <SelectContent>
            {subrubros.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "todos" ? "Todos los subrubros" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          className="rounded-xl shrink-0"
          onClick={onReload}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button
          className="rounded-xl gap-2 shrink-0"
          onClick={() => setImportOpen(true)}
        >
          <Upload className="h-4 w-4" />
          Importar Excel
        </Button>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-16">
          <FileSpreadsheet className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {productos.length === 0
              ? "No hay productos importados. Usá el botón \"Importar Excel\" para comenzar."
              : "No hay productos que coincidan con los filtros."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  {prefs.showCodigoBarras && (
                    <th className="text-left px-3 py-3 font-semibold text-muted-foreground whitespace-nowrap">
                      Cód. barras
                    </th>
                  )}
                  <th className="text-left px-3 py-3 font-semibold text-muted-foreground">Código</th>
                  <th className="text-left px-3 py-3 font-semibold text-muted-foreground">Descripción</th>
                  <th className="text-right px-3 py-3 font-semibold text-muted-foreground whitespace-nowrap">
                    Cons. Final
                  </th>
                  {prefs.showRubro && (
                    <th className="text-left px-3 py-3 font-semibold text-muted-foreground">Rubro</th>
                  )}
                  {prefs.showSubrubro && (
                    <>
                      <th className="text-left px-3 py-3 font-semibold text-muted-foreground">Subrubro 1</th>
                      <th className="text-left px-3 py-3 font-semibold text-muted-foreground">Subrubro 2</th>
                      <th className="text-left px-3 py-3 font-semibold text-muted-foreground">Subrubro 3</th>
                    </>
                  )}
                  <th className="text-left px-3 py-3 font-semibold text-muted-foreground">Categoría</th>
                  <th className="text-center px-3 py-3 font-semibold text-muted-foreground">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filasPagina.map((p) => {
                  const [s1, s2, s3] = getSubrubros(p.subrubro ?? "");
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-muted/20 transition-colors ${p.habilitado ? "bg-teal-50/30 dark:bg-teal-950/10" : ""}`}
                    >
                      {prefs.showCodigoBarras && (
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {p.codigoBarras || "—"}
                        </td>
                      )}
                      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                        {p.codigo}
                      </td>
                      <td className="px-3 py-2.5 font-medium max-w-[220px] truncate">{p.nombre}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-teal-600 whitespace-nowrap">
                        {formatCurrency(p.precioUnitarioMayorista)}
                      </td>
                      {prefs.showRubro && (
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {p.rubro || "—"}
                        </td>
                      )}
                      {prefs.showSubrubro && (
                        <>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                            {s1 || "—"}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                            {s2 || "—"}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                            {s3 || "—"}
                          </td>
                        </>
                      )}
                      <td className="px-3 py-2.5">
                        {editingCategoria === p.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={categoriaInput}
                              onChange={(e) => setCategoriaInput(e.target.value)}
                              className="h-7 text-xs rounded-lg w-28"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") guardarCategoria(p.id);
                                if (e.key === "Escape") setEditingCategoria(null);
                              }}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => guardarCategoria(p.id)}
                            >
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => setEditingCategoria(null)}
                            >
                              <X className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            className="flex items-center gap-1.5 group"
                            onClick={() => {
                              setEditingCategoria(p.id);
                              setCategoriaInput(p.categoria);
                            }}
                          >
                            <Badge variant="secondary" className="text-xs font-normal">
                              {p.categoria || "Sin categoría"}
                            </Badge>
                            <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {p.habilitado ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs rounded-lg text-destructive border-destructive/30 hover:bg-destructive/10 gap-1"
                            onClick={async () => {
                              try {
                                await deshabilitarProducto(p.id);
                                onHabilitarChange(p.id, { habilitado: false });
                                toast.success("Producto deshabilitado");
                              } catch {
                                toast.error("Error al deshabilitar");
                              }
                            }}
                          >
                            <PackageX className="h-3 w-3" />
                            Deshabilitar
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs rounded-lg text-teal-600 border-teal-600/30 hover:bg-teal-50 dark:hover:bg-teal-950/30 gap-1"
                            onClick={() => setHabilitarTarget(p)}
                          >
                            <PackagePlus className="h-3 w-3" />
                            Habilitar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 bg-muted/30 border-t flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {hayFiltros
                ? `${filtrados.length} resultados`
                : `${filtrados.length} productos · página ${currentPage} de ${totalPages}`}
              {productos.filter((p) => p.habilitado).length > 0 && (
                <span className="ml-3 text-teal-600 font-medium">
                  · {productos.filter((p) => p.habilitado).length} habilitados
                </span>
              )}
            </span>
            {!hayFiltros && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-lg text-xs"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  ← Anterior
                </Button>
                <span className="text-xs text-muted-foreground px-2 tabular-nums">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-lg text-xs"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  Siguiente →
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de importación */}
      <ExcelImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImportado={async () => {
          const actualizados = await getMayoristaProductos();
          onProductosImportados(actualizados);
          setImportOpen(false);
          toast.success(`${actualizados.length} productos importados`);
        }}
      />

      {/* Modal habilitar producto */}
      {habilitarTarget && (
        <HabilitarModal
          producto={habilitarTarget}
          onClose={() => setHabilitarTarget(null)}
          onConfirm={(changes) => {
            onHabilitarChange(habilitarTarget.id, changes);
            setHabilitarTarget(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Modal para habilitar un producto ────────────────────────────────────────
function HabilitarModal({
  producto,
  onClose,
  onConfirm,
}: {
  producto: MayoristaProducto;
  onClose: () => void;
  onConfirm: (changes: Partial<MayoristaProducto>) => void;
}) {
  const [lote, setLote] = useState(producto.lote ? String(producto.lote) : "");
  const [seDivide, setSeDivide] = useState(
    producto.seDivideEn ? String(producto.seDivideEn) : ""
  );
  const [saving, setSaving] = useState(false);

  const loteNum = parseInt(lote) || 0;
  const divideNum = parseInt(seDivide) || 0;
  const porciones = divideNum > 0 ? Math.floor(loteNum / divideNum) : 0;

  const handleConfirmar = async () => {
    if (loteNum <= 0 || divideNum <= 0) {
      toast.error("Ingresá valores válidos para lote y división");
      return;
    }
    setSaving(true);
    try {
      await habilitarProducto(producto, loteNum, divideNum);
      toast.success(`"${producto.nombre}" habilitado — ${porciones} porciones en stock`);
      onConfirm({
        habilitado: true,
        lote: loteNum,
        seDivideEn: divideNum,
      });
    } catch {
      toast.error("Error al habilitar el producto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-teal-600" />
            Habilitar producto
          </DialogTitle>
          <DialogDescription className="font-medium text-foreground/80 line-clamp-2">
            {producto.nombre}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {producto.precioVenta <= 0 && (
            <div className="flex items-start gap-2 text-xs bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>Este producto no tiene precio de venta configurado. Podés habilitarlo igual y asignar el precio después.</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="lote" className="text-sm">
                Lote total
              </Label>
              <Input
                id="lote"
                type="number"
                min="1"
                placeholder="Ej: 30"
                value={lote}
                onChange={(e) => setLote(e.target.value)}
                className="rounded-xl"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Cuántas unidades entran</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="divide" className="text-sm">
                Se divide en
              </Label>
              <Input
                id="divide"
                type="number"
                min="1"
                placeholder="Ej: 10"
                value={seDivide}
                onChange={(e) => setSeDivide(e.target.value)}
                className="rounded-xl"
              />
              <p className="text-xs text-muted-foreground">Unidades por porción</p>
            </div>
          </div>

          {loteNum > 0 && divideNum > 0 && (
            <div className="rounded-xl bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800 p-3 text-center">
              <p className="text-2xl font-bold text-teal-600">{porciones}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                porciones de {divideNum} unidades cada una
              </p>
              <p className="text-xs text-teal-600 font-medium mt-1">
                → Stock que se cargará en Productos: {porciones}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={saving || loteNum <= 0 || divideNum <= 0}
            className="gap-2"
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Habilitar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog de importación Excel ─────────────────────────────────────────────
function ExcelImportDialog({
  open,
  onOpenChange,
  onImportado,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImportado: () => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "mapping" | "preview">("upload");
  const [columns, setColumns] = useState<ExcelColumn[]>([]);
  const [rawRows, setRawRows] = useState<unknown[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    codigoBarras: "A",
    codigo: "B",
    nombre: "C",
    precioUnitario: "D",
    rubro: "E",
    subrubro: "F",
    unidadesPorBulto: "H",
  });
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const reset = () => {
    setStep("upload");
    setColumns([]);
    setRawRows([]);
    setParsed([]);
    setSaving(false);
    setProgress({ done: 0, total: 0 });
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: "",
        }) as unknown[][];

        if (rows.length < 2) {
          toast.error("El archivo no tiene suficientes filas");
          return;
        }

        const maxCols = Math.max(...rows.slice(0, 3).map((r) => (r as unknown[]).length));
        const cols: ExcelColumn[] = [];
        for (let i = 0; i < maxCols; i++) {
          const letter = colIndexToLetter(i);
          const header = cellToString((rows[0] as unknown[])[i]);
          const preview = rows
            .slice(1, 4)
            .map((r) => cellToString((r as unknown[])[i]));
          cols.push({ letter, header, preview });
        }

        setColumns(cols);
        setRawRows(rows);
        setStep("mapping");
      } catch {
        toast.error("Error al leer el archivo Excel");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const previewMapping = () => {
    const letterToIndex = (letter: string) => {
      let index = 0;
      for (let i = 0; i < letter.length; i++) {
        index = index * 26 + (letter.charCodeAt(i) - 64);
      }
      return index - 1;
    };

    const rows = rawRows.slice(1);
    const result: ParsedRow[] = rows
      .map((row) => {
        const r = row as unknown[];
        const rubro = cellToString(r[letterToIndex(mapping.rubro)]);
        return {
          codigoBarras: cellToString(r[letterToIndex(mapping.codigoBarras)]),
          codigo: cellToString(r[letterToIndex(mapping.codigo)]),
          nombre: cellToString(r[letterToIndex(mapping.nombre)]),
          precioUnitarioMayorista: cellToNumber(r[letterToIndex(mapping.precioUnitario)]),
          rubro,
          subrubro: cellToString(r[letterToIndex(mapping.subrubro)]),
          unidadesPorBulto: cellToNumber(r[letterToIndex(mapping.unidadesPorBulto)]) || 1,
          // Categoría = rubro (son lo mismo)
          categoria: rubro || "Sin categoría",
        };
      })
      // Excluir filas vacías Y filas de encabezado (precio = 0 y sin código numérico real)
      .filter((r) => r.codigo && r.nombre && r.precioUnitarioMayorista > 0);

    if (result.length === 0) {
      toast.error("No se encontraron filas válidas con el mapeo actual");
      return;
    }
    setParsed(result);
    setStep("preview");
  };

  const confirmar = async () => {
    setSaving(true);
    setProgress({ done: 0, total: parsed.length });
    try {
      await upsertMayoristaProductos(parsed, (done, total) =>
        setProgress({ done, total })
      );
      await onImportado();
    } catch {
      toast.error("Error al importar los productos");
    } finally {
      setSaving(false);
    }
  };

  const camposRequeridos: { key: keyof ColumnMapping; label: string }[] = [
    { key: "codigoBarras", label: "Código de barras (col A)" },
    { key: "codigo", label: "Código (col B)" },
    { key: "nombre", label: "Descripción / Nombre (col C)" },
    { key: "precioUnitario", label: "Precio Cons. Final (col D)" },
    { key: "rubro", label: "Rubro / Categoría (col E)" },
    { key: "subrubro", label: "Subrubro (col F)" },
    { key: "unidadesPorBulto", label: "Unidades por bulto" },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-xl sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-teal-600" />
            Importar lista de precios
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Seleccioná el archivo Excel con la lista del mayorista."}
            {step === "mapping" && "Indicá qué columna del Excel corresponde a cada campo."}
            {step === "preview" && "Revisá los datos antes de confirmar la importación."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={step === "upload" ? "font-bold text-foreground" : ""}>1. Archivo</span>
          <ArrowRight className="h-3 w-3" />
          <span className={step === "mapping" ? "font-bold text-foreground" : ""}>2. Mapeo</span>
          <ArrowRight className="h-3 w-3" />
          <span className={step === "preview" ? "font-bold text-foreground" : ""}>3. Confirmar</span>
        </div>

        {step === "upload" && (
          <div className="space-y-4">
            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-2xl cursor-pointer hover:border-teal-500 hover:bg-teal-50/5 transition-colors">
              <Upload className="h-10 w-10 text-muted-foreground/40 mb-2" />
              <span className="text-sm font-medium text-muted-foreground">
                Hacé clic para seleccionar un archivo .xlsx
              </span>
              <span className="text-xs text-muted-foreground/60 mt-1">
                Columnas esperadas: A=Cód.barras, B=Código, C=Nombre, D=Precio, E=Rubro, F=Subrubro
              </span>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFile}
              />
            </label>
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-xl p-3">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
              <span>
                Los datos existentes (precio de venta, stock, habilitados) se conservarán.
                El código del producto se usa para identificar si ya existe.
              </span>
            </div>
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground bg-muted/30 rounded-xl p-3">
              Se detectaron <strong>{columns.length} columnas</strong>. Asigná cada campo a su columna.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {camposRequeridos.map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <Select
                    value={mapping[key]}
                    onValueChange={(v) =>
                      setMapping((prev) => ({ ...prev, [key]: v }))
                    }
                  >
                    <SelectTrigger className="rounded-xl h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {columns.map((col) => (
                        <SelectItem key={col.letter} value={col.letter}>
                          <span className="font-mono font-bold text-teal-600 mr-1.5">{col.letter}</span>
                          <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {col.header || col.preview.filter(Boolean)[0] || "—"}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Preview compacto solo primeras 3 cols */}
            <div className="rounded-xl border overflow-hidden text-xs">
              <p className="bg-muted/50 px-3 py-1.5 font-medium text-muted-foreground border-b text-xs">
                Vista previa del archivo (primeras 3 filas)
              </p>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      {columns.slice(0, 8).map((col) => (
                        <th key={col.letter} className="px-2 py-1 text-left font-mono text-teal-600 bg-muted/20 border-r last:border-r-0 text-xs whitespace-nowrap">
                          {col.letter}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rawRows.slice(0, 3).map((row, ri) => (
                      <tr key={ri} className="border-t">
                        {(row as unknown[]).slice(0, 8).map((cell, ci) => (
                          <td key={ci} className="px-2 py-1 border-r last:border-r-0 max-w-[90px] truncate text-xs">
                            {cellToString(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between gap-2">
              <Button variant="outline" size="sm" className="rounded-xl" onClick={reset}>Volver</Button>
              <Button size="sm" className="rounded-xl" onClick={previewMapping}>Ver preview →</Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-3">
              Se van a importar <strong>{parsed.length} productos</strong>.
              Los precios de venta, stock y productos habilitados se conservarán.
            </div>

            <div className="rounded-xl border overflow-hidden">
              <div className="overflow-x-auto max-h-52">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-2 font-semibold whitespace-nowrap">Cód.barras</th>
                      <th className="text-left px-2 py-2 font-semibold">Código</th>
                      <th className="text-left px-2 py-2 font-semibold">Nombre</th>
                      <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">Precio</th>
                      <th className="text-left px-2 py-2 font-semibold hidden sm:table-cell">Rubro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {parsed.slice(0, 200).map((row, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="px-2 py-1 font-mono text-muted-foreground whitespace-nowrap">{row.codigoBarras || "—"}</td>
                        <td className="px-2 py-1 font-mono text-muted-foreground whitespace-nowrap">{row.codigo}</td>
                        <td className="px-2 py-1 max-w-[140px] truncate">{row.nombre}</td>
                        <td className="px-2 py-1 text-right text-teal-600 font-semibold whitespace-nowrap">
                          {formatCurrency(row.precioUnitarioMayorista)}
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap hidden sm:table-cell">{row.rubro || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsed.length > 200 && (
                <p className="text-xs text-muted-foreground px-3 py-1.5 border-t bg-muted/20">
                  Mostrando 200 de {parsed.length} filas en la vista previa
                </p>
              )}
            </div>

            {saving && progress.total > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Guardando en Firestore...</span>
                  <span className="font-medium tabular-nums">
                    {progress.done} / {progress.total}
                  </span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-between gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setStep("mapping")}
                disabled={saving}
              >
                Volver
              </Button>
              <Button
                className="rounded-xl gap-2"
                onClick={confirmar}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    {progress.total > 0
                      ? `${Math.round((progress.done / progress.total) * 100)}%`
                      : "Preparando..."}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Confirmar importación
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Tab 2: Precios de venta ──────────────────────────────────────────────────
function PreciosVenta({
  productos,
  loading,
  onPrecioChange,
  onGananciaGlobalApplied,
}: {
  productos: MayoristaProducto[];
  loading: boolean;
  onPrecioChange: (id: string, precio: number) => void;
  onGananciaGlobalApplied: (porc: number) => void;
}) {
  const [gananciaInput, setGananciaInput] = useState("");
  const [applyingGlobal, setApplyingGlobal] = useState(false);
  const [search, setSearch] = useState("");
  const [rubroFiltro, setRubroFiltro] = useState("todos");
  const [editingPrecio, setEditingPrecio] = useState<string | null>(null);
  const [precioInput, setPrecioInput] = useState("");

  const rubros = useMemo(() => {
    const set = new Set(productos.map((p) => p.rubro).filter(Boolean));
    return ["todos", ...Array.from(set as Set<string>).sort()];
  }, [productos]);

  const filtrados = useMemo(() => {
    const q = search.toLowerCase();
    return productos.filter((p) => {
      const matchSearch =
        !q || p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q);
      const matchRubro = rubroFiltro === "todos" || p.rubro === rubroFiltro;
      return matchSearch && matchRubro;
    });
  }, [productos, search, rubroFiltro]);

  const handleAplicarGlobal = async () => {
    const porc = parseFloat(gananciaInput);
    if (isNaN(porc) || porc < 0) {
      toast.error("Ingresá un porcentaje válido");
      return;
    }
    setApplyingGlobal(true);
    try {
      await applyGananciaGlobal(porc);
      onGananciaGlobalApplied(porc);
      toast.success(`Ganancia global del ${porc}% aplicada a ${productos.length} productos`);
    } catch {
      toast.error("Error al aplicar la ganancia global");
    } finally {
      setApplyingGlobal(false);
    }
  };

  const guardarPrecio = async (id: string) => {
    const precio = parseFloat(precioInput.replace(",", "."));
    if (isNaN(precio) || precio < 0) {
      toast.error("Precio inválido");
      return;
    }
    try {
      await updateMayoristaProducto(id, { precioVenta: precio });
      onPrecioChange(id, precio);
      setEditingPrecio(null);
      toast.success("Precio actualizado");
    } catch {
      toast.error("Error al guardar el precio");
    }
  };

  const gananciaActual = productos.find((p) => p.gananciaGlobal != null)?.gananciaGlobal;

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Percent className="h-4 w-4 text-teal-600" />
            Ganancia global
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Input
                type="number"
                min="0"
                max="500"
                step="0.5"
                value={gananciaInput}
                onChange={(e) => setGananciaInput(e.target.value)}
                placeholder={gananciaActual != null ? `Actual: ${gananciaActual}%` : "Ej: 30"}
                className="rounded-xl max-w-[160px]"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <Button
              onClick={handleAplicarGlobal}
              disabled={applyingGlobal || !gananciaInput}
              className="rounded-xl gap-2"
            >
              {applyingGlobal ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Aplicar a todos
            </Button>
          </div>
          {gananciaActual != null && (
            <p className="text-xs text-muted-foreground mt-2">
              Última ganancia aplicada: <strong>{gananciaActual}%</strong>
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl"
          />
          {search && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => setSearch("")}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <Select value={rubroFiltro} onValueChange={setRubroFiltro}>
          <SelectTrigger className="w-full sm:w-48 rounded-xl">
            <SelectValue placeholder="Rubro" />
          </SelectTrigger>
          <SelectContent>
            {rubros.map((r) => (
              <SelectItem key={r} value={r}>
                {r === "todos" ? "Todos los rubros" : r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-16">
          <Percent className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {productos.length === 0
              ? "Importá productos primero desde la pestaña \"Lista de precios\"."
              : "No hay productos que coincidan."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Nombre</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Rubro</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Precio mayorista</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Ganancia</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Precio de venta</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtrados.map((p) => {
                  const ganancia =
                    p.precioUnitarioMayorista > 0
                      ? ((p.precioVenta - p.precioUnitarioMayorista) / p.precioUnitarioMayorista) * 100
                      : 0;
                  return (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium max-w-xs truncate">{p.nombre}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-xs font-normal">
                          {p.rubro || p.categoria}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {formatCurrency(p.precioUnitarioMayorista)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                        {p.precioVenta > 0 ? `${ganancia.toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {editingPrecio === p.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={precioInput}
                              onChange={(e) => setPrecioInput(e.target.value)}
                              className="h-7 text-xs rounded-lg w-28 text-right"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") guardarPrecio(p.id);
                                if (e.key === "Escape") setEditingPrecio(null);
                              }}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => guardarPrecio(p.id)}
                            >
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => setEditingPrecio(null)}
                            >
                              <X className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            className="flex items-center gap-1.5 justify-end group w-full"
                            onClick={() => {
                              setEditingPrecio(p.id);
                              setPrecioInput(p.precioVenta > 0 ? String(p.precioVenta) : "");
                            }}
                          >
                            <span className="font-bold text-teal-600">
                              {p.precioVenta > 0 ? formatCurrency(p.precioVenta) : (
                                <span className="text-muted-foreground font-normal text-xs">Sin precio</span>
                              )}
                            </span>
                            <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 bg-muted/30 border-t text-xs text-muted-foreground">
            {filtrados.length} de {productos.length} productos
          </div>
        </div>
      )}
    </div>
  );
}
