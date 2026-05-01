"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import * as XLSX from "xlsx";
import type { MayoristaProducto } from "@/lib/types";
import {
  getMayoristaProductos,
  upsertMayoristaProductos,
  updateMayoristaProducto,
  applyGananciaGlobal,
} from "@/services/mayorista-service";
import { formatCurrency } from "@/lib/utils/format";

// ─── Tipos internos ───────────────────────────────────────────────────────────
type ColumnLetter = string;

interface ExcelColumn {
  letter: ColumnLetter;
  header: string;
  preview: string[];
}

interface ColumnMapping {
  codigo: ColumnLetter;
  nombre: ColumnLetter;
  precioUnitario: ColumnLetter;
  unidadesPorBulto: ColumnLetter;
  categoria: ColumnLetter;
}

interface ParsedRow {
  codigo: string;
  nombre: string;
  precioUnitarioMayorista: number;
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

// ─── Componente principal ─────────────────────────────────────────────────────
export default function MayoristaPage() {
  const [productos, setProductos] = useState<MayoristaProducto[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <MainLayout title="Mayorista" description="Gestión de productos y precios del mayorista">
      <div className="space-y-4">
        <PageHeader description="Productos y precios del mayorista" />
        <Tabs defaultValue="lista">
          <TabsList className="rounded-xl">
            <TabsTrigger value="lista" className="rounded-lg">Lista de precios</TabsTrigger>
            <TabsTrigger value="precios" className="rounded-lg">Precios de venta</TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="mt-4">
            <ListaPrecios
              productos={productos}
              loading={loading}
              onReload={cargar}
              onProductosImportados={(nuevos) => setProductos(nuevos)}
              onCategoriaChange={(id, cat) =>
                setProductos((prev) =>
                  prev.map((p) => (p.id === id ? { ...p, categoria: cat } : p))
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
  onReload,
  onProductosImportados,
  onCategoriaChange,
}: {
  productos: MayoristaProducto[];
  loading: boolean;
  onReload: () => void;
  onProductosImportados: (nuevos: MayoristaProducto[]) => void;
  onCategoriaChange: (id: string, cat: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas");
  const [importOpen, setImportOpen] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<string | null>(null);
  const [categoriaInput, setCategoriaInput] = useState("");

  const categorias = useMemo(() => {
    const set = new Set(productos.map((p) => p.categoria).filter(Boolean));
    return ["todas", ...Array.from(set).sort()];
  }, [productos]);

  const filtrados = useMemo(() => {
    const q = search.toLowerCase();
    return productos.filter((p) => {
      const matchSearch =
        !q ||
        p.nombre.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q);
      const matchCat =
        categoriaFiltro === "todas" || p.categoria === categoriaFiltro;
      return matchSearch && matchCat;
    });
  }, [productos, search, categoriaFiltro]);

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
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o código..."
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
        <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
          <SelectTrigger className="w-full sm:w-52 rounded-xl">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            {categorias.map((c) => (
              <SelectItem key={c} value={c}>
                {c === "todas" ? "Todas las categorías" : c}
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
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Código</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Nombre</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Categoría</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Precio mayorista</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Uds/bulto</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Stock local</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtrados.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {p.codigo}
                    </td>
                    <td className="px-4 py-3 font-medium max-w-xs truncate">{p.nombre}</td>
                    <td className="px-4 py-3">
                      {editingCategoria === p.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={categoriaInput}
                            onChange={(e) => setCategoriaInput(e.target.value)}
                            className="h-7 text-xs rounded-lg w-32"
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
                    <td className="px-4 py-3 text-right font-semibold text-teal-600">
                      {formatCurrency(p.precioUnitarioMayorista)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {p.unidadesPorBulto}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={p.stockLocal === 0 ? "text-destructive font-semibold" : "font-semibold"}>
                        {p.stockLocal}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 bg-muted/30 border-t text-xs text-muted-foreground">
            {filtrados.length} de {productos.length} productos
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
    </div>
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
    codigo: "A",
    nombre: "B",
    precioUnitario: "D",
    unidadesPorBulto: "H",
    categoria: "S",
  });
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setStep("upload");
    setColumns([]);
    setRawRows([]);
    setParsed([]);
    setSaving(false);
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

        // Detectar columnas disponibles
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

    const rows = rawRows.slice(1); // skip header
    const result: ParsedRow[] = rows
      .map((row) => {
        const r = row as unknown[];
        return {
          codigo: cellToString(r[letterToIndex(mapping.codigo)]),
          nombre: cellToString(r[letterToIndex(mapping.nombre)]),
          precioUnitarioMayorista: cellToNumber(r[letterToIndex(mapping.precioUnitario)]),
          unidadesPorBulto: cellToNumber(r[letterToIndex(mapping.unidadesPorBulto)]) || 1,
          categoria: cellToString(r[letterToIndex(mapping.categoria)]) || "Sin categoría",
        };
      })
      .filter((r) => r.codigo && r.nombre);

    if (result.length === 0) {
      toast.error("No se encontraron filas válidas con el mapeo actual");
      return;
    }
    setParsed(result);
    setStep("preview");
  };

  const confirmar = async () => {
    setSaving(true);
    try {
      await upsertMayoristaProductos(parsed);
      await onImportado();
    } catch {
      toast.error("Error al importar los productos");
    } finally {
      setSaving(false);
    }
  };

  const camposRequeridos: { key: keyof ColumnMapping; label: string }[] = [
    { key: "codigo", label: "Código" },
    { key: "nombre", label: "Nombre" },
    { key: "precioUnitario", label: "Precio unitario mayorista" },
    { key: "unidadesPorBulto", label: "Unidades por bulto" },
    { key: "categoria", label: "Categoría" },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
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

        {/* Indicador de pasos */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={step === "upload" ? "font-bold text-foreground" : ""}>1. Archivo</span>
          <ArrowRight className="h-3 w-3" />
          <span className={step === "mapping" ? "font-bold text-foreground" : ""}>2. Mapeo</span>
          <ArrowRight className="h-3 w-3" />
          <span className={step === "preview" ? "font-bold text-foreground" : ""}>3. Confirmar</span>
        </div>

        {/* Paso 1: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-2xl cursor-pointer hover:border-teal-500 hover:bg-teal-50/5 transition-colors">
              <Upload className="h-10 w-10 text-muted-foreground/40 mb-2" />
              <span className="text-sm font-medium text-muted-foreground">
                Hacé clic para seleccionar un archivo .xlsx
              </span>
              <span className="text-xs text-muted-foreground/60 mt-1">
                Solo archivos Excel (.xlsx, .xls)
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
                En el siguiente paso podrás indicar qué columna corresponde a cada campo.
                Los datos existentes del mayorista (precios de venta y stock) se conservarán.
              </span>
            </div>
          </div>
        )}

        {/* Paso 2: Mapeo */}
        {step === "mapping" && (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground bg-muted/30 rounded-xl p-3">
              Se detectaron <strong>{columns.length} columnas</strong> en el archivo.
              Asigná cada campo del sistema a la columna correcta.
            </div>

            <div className="space-y-3">
              {camposRequeridos.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-48 shrink-0">{label}</span>
                  <Select
                    value={mapping[key]}
                    onValueChange={(v) =>
                      setMapping((prev) => ({ ...prev, [key]: v }))
                    }
                  >
                    <SelectTrigger className="rounded-xl flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {columns.map((col) => (
                        <SelectItem key={col.letter} value={col.letter}>
                          <span className="font-mono font-bold text-teal-600 mr-2">
                            {col.letter}
                          </span>
                          {col.header && (
                            <span className="text-muted-foreground mr-1">{col.header} —</span>
                          )}
                          <span className="text-xs text-muted-foreground/70">
                            {col.preview.filter(Boolean).slice(0, 2).join(", ")}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Preview de columnas */}
            <div className="rounded-xl border overflow-hidden text-xs">
              <div className="bg-muted/50 px-3 py-2 font-semibold border-b text-muted-foreground">
                Primeras filas del archivo
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      {columns.slice(0, 10).map((col) => (
                        <th key={col.letter} className="px-2 py-1.5 text-left font-mono text-teal-600 bg-muted/20 border-b border-r last:border-r-0">
                          {col.letter}
                        </th>
                      ))}
                      {columns.length > 10 && <th className="px-2 py-1.5 text-muted-foreground">...</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rawRows.slice(0, 4).map((row, ri) => (
                      <tr key={ri} className="border-b last:border-b-0">
                        {(row as unknown[]).slice(0, 10).map((cell, ci) => (
                          <td key={ci} className="px-2 py-1 border-r last:border-r-0 max-w-[100px] truncate">
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
              <Button variant="outline" className="rounded-xl" onClick={reset}>
                Volver
              </Button>
              <Button className="rounded-xl" onClick={previewMapping}>
                Ver preview
              </Button>
            </div>
          </div>
        )}

        {/* Paso 3: Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-3">
              Se van a importar <strong>{parsed.length} productos</strong>.
              Los precios de venta y stock actuales se conservarán.
            </div>

            <div className="rounded-xl border overflow-hidden">
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Código</th>
                      <th className="text-left px-3 py-2 font-semibold">Nombre</th>
                      <th className="text-left px-3 py-2 font-semibold">Categoría</th>
                      <th className="text-right px-3 py-2 font-semibold">Precio mayorista</th>
                      <th className="text-right px-3 py-2 font-semibold">Uds/bulto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {parsed.map((row, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="px-3 py-1.5 font-mono text-muted-foreground">{row.codigo}</td>
                        <td className="px-3 py-1.5 max-w-[200px] truncate">{row.nombre}</td>
                        <td className="px-3 py-1.5">{row.categoria}</td>
                        <td className="px-3 py-1.5 text-right text-teal-600 font-semibold">
                          {formatCurrency(row.precioUnitarioMayorista)}
                        </td>
                        <td className="px-3 py-1.5 text-right">{row.unidadesPorBulto}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

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
                    Importando...
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
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas");
  const [editingPrecio, setEditingPrecio] = useState<string | null>(null);
  const [precioInput, setPrecioInput] = useState("");

  const categorias = useMemo(() => {
    const set = new Set(productos.map((p) => p.categoria).filter(Boolean));
    return ["todas", ...Array.from(set).sort()];
  }, [productos]);

  const filtrados = useMemo(() => {
    const q = search.toLowerCase();
    return productos.filter((p) => {
      const matchSearch =
        !q || p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q);
      const matchCat =
        categoriaFiltro === "todas" || p.categoria === categoriaFiltro;
      return matchSearch && matchCat;
    });
  }, [productos, search, categoriaFiltro]);

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

  // Porcentaje de ganancia actual (del primero que tenga gananciaGlobal)
  const gananciaActual = productos.find((p) => p.gananciaGlobal != null)?.gananciaGlobal;

  return (
    <div className="space-y-4">
      {/* Panel de ganancia global */}
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

      {/* Filtros */}
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
        <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
          <SelectTrigger className="w-full sm:w-52 rounded-xl">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            {categorias.map((c) => (
              <SelectItem key={c} value={c}>
                {c === "todas" ? "Todas las categorías" : c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabla de precios */}
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
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Categoría</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Precio mayorista</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Ganancia</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Precio de venta</th>
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
                          {p.categoria}
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
