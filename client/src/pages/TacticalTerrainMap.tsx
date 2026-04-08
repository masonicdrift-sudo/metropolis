import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import L from "leaflet";
import {
  MapContainer,
  GeoJSON,
  Marker,
  Polygon,
  Polyline,
  Tooltip,
  useMapEvents,
} from "react-leaflet";
import ms from "milsymbol";
import "leaflet/dist/leaflet.css";

import { useAuth } from "@/lib/auth";
import { matchesMobileShell, useIsMobile } from "@/hooks/use-mobile";
import { apiRequest } from "@/lib/queryClient";
import type {
  TacticalMapBuildingLabel,
  TacticalMapLine,
  TacticalMapMarker,
  TacticalMapRangeRing,
} from "@shared/schema";
import {
  findBuildingFeatureAt,
  stableFeatureKey,
  type GeoJsonFeatureLike,
} from "@/lib/tacticalBuildings";
import { useToast } from "@/hooks/use-toast";
import type { TacAffiliation } from "@shared/natoSidc";
import {
  NATO_FRIENDLY_SIDCS,
  resolveMarkerSidc,
  sidcForAffiliation,
} from "@shared/natoSidc";
import {
  FitBoundsDebouncedOncePerMap,
  GameGridOverlay,
  InvalidateMapSizeOnResize,
  MapCursorCoords,
} from "@/components/tactical/TacticalLeafletExtras";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronsUpDown,
  Layers,
  MapPinned,
  AlertTriangle,
  PenLine,
  Target,
  Building2,
  Trash2,
  Undo2,
} from "lucide-react";

function gameCoordsToLatLng(coords: number[]): L.LatLng {
  const x = coords[0];
  const z = coords[1] ?? coords[0];
  return L.latLng(z, x);
}

function makeNatoDivIcon(sidc: string, uniqueDesignation?: string): L.DivIcon {
  const opts: { size: number; fill: boolean; uniqueDesignation?: string } = {
    size: 30,
    fill: true,
  };
  const t = uniqueDesignation?.trim();
  if (t) opts.uniqueDesignation = t;
  const sym = new ms.Symbol(sidc, opts);
  const { width, height } = sym.getSize();
  const anchor = sym.getAnchor();
  return L.divIcon({
    html: sym.asSVG(),
    className: "tac-nato-leaflet-icon",
    iconSize: [width, height],
    iconAnchor: [anchor.x, anchor.y],
  });
}

function symbolSvg(
  sidc: string,
  size: number,
  uniqueDesignation?: string,
): string {
  const opts: { size: number; fill: boolean; uniqueDesignation?: string } = {
    size,
    fill: true,
  };
  const t = uniqueDesignation?.trim();
  if (t) opts.uniqueDesignation = t;
  return new ms.Symbol(sidc, opts).asSVG();
}

/** Closed ring in game X/Z plane; Leaflet lat = Z, lng = X. */
function rangeRingLatLngs(
  centerX: number,
  centerZ: number,
  radiusM: number,
  segments = 72,
): L.LatLngTuple[] {
  const out: L.LatLngTuple[] = [];
  const r = Math.max(1, radiusM);
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * 2 * Math.PI;
    const x = centerX + r * Math.cos(t);
    const z = centerZ + r * Math.sin(t);
    out.push([z, x]);
  }
  return out;
}

function tacMarkerCaption(
  m: TacticalMapMarker,
  catalogRows: { value: string; label: string }[],
): string {
  const t = m.label?.trim();
  if (t) return t;
  if (m.markerType.startsWith("custom:")) return "Custom SIDC";
  const row = catalogRows.find((r) => r.value === m.markerType);
  if (row) return row.label;
  return m.markerType.replace(/_/g, " ");
}

function MapInteractionHandler({
  placeEnabled,
  lineEnabled,
  ringEnabled,
  buildingEnabled,
  onPlaceClick,
  onLineClick,
  onRingClick,
  onBuildingClick,
}: {
  placeEnabled: boolean;
  lineEnabled: boolean;
  ringEnabled: boolean;
  buildingEnabled: boolean;
  onPlaceClick: (ll: L.LatLng) => void;
  onLineClick: (ll: L.LatLng) => void;
  onRingClick: (ll: L.LatLng) => void;
  onBuildingClick: (ll: L.LatLng) => void;
}) {
  useMapEvents({
    click(e) {
      if (placeEnabled) onPlaceClick(e.latlng);
      else if (lineEnabled) onLineClick(e.latlng);
      else if (ringEnabled) onRingClick(e.latlng);
      else if (buildingEnabled) onBuildingClick(e.latlng);
    },
  });
  return null;
}

function affiliationUiLabel(a: string): string {
  switch (a) {
    case "friendly":
      return "Friendly (BLUFOR)";
    case "hostile":
      return "Hostile (OPFOR)";
    case "neutral":
      return "Neutral";
    case "unknown":
      return "Unknown";
    default:
      return a;
  }
}

interface TerrainMeta {
  name?: string;
  bounds?: { min: number[]; max: number[] };
  size?: { x: number; y: number; z: number };
}

type Fc = { type: "FeatureCollection"; features: unknown[] };

function walkGeoCoords(
  coords: unknown,
  fn: (x: number, z: number) => void,
): void {
  if (coords == null) return;
  if (Array.isArray(coords)) {
    if (
      coords.length >= 2 &&
      typeof coords[0] === "number" &&
      typeof (coords.length >= 3 ? coords[2] : coords[1]) === "number"
    ) {
      const x = coords[0] as number;
      const z = (coords.length >= 3 ? coords[2] : coords[1]) as number;
      if (Number.isFinite(x) && Number.isFinite(z)) fn(x, z);
    } else {
      for (const c of coords) walkGeoCoords(c, fn);
    }
  }
}

function extendBoundsFromGeoJSON(fc: Fc | undefined, b: L.LatLngBounds): void {
  if (!fc?.features?.length) return;
  for (const f of fc.features) {
    const geom = (f as { geometry?: { coordinates?: unknown } }).geometry;
    if (!geom?.coordinates) continue;
    walkGeoCoords(geom.coordinates, (x, z) => b.extend(L.latLng(z, x)));
  }
}

const TAC_MAP_STORAGE_KEY = "tacedge.tacMapKey";

function canDeleteMarker(
  m: TacticalMapMarker,
  username: string | undefined,
  accessLevel: string | undefined,
): boolean {
  if (!username) return false;
  if (m.createdBy === username) return true;
  return accessLevel === "admin" || accessLevel === "owner";
}

/** Repositioning is allowed for any logged-in user (shared map); deletion uses canDeleteMarker. */
function canDragMarker(username: string | undefined): boolean {
  return !!username;
}

function canDeleteLine(
  line: TacticalMapLine,
  username: string | undefined,
  accessLevel: string | undefined,
): boolean {
  if (!username) return false;
  if (line.createdBy === username) return true;
  return accessLevel === "admin" || accessLevel === "owner";
}

function canDeleteRangeRing(
  ring: TacticalMapRangeRing,
  username: string | undefined,
  accessLevel: string | undefined,
): boolean {
  if (!username) return false;
  if (ring.createdBy === username) return true;
  return accessLevel === "admin" || accessLevel === "owner";
}

function canDeleteBuildingLabel(
  row: TacticalMapBuildingLabel,
  username: string | undefined,
  accessLevel: string | undefined,
): boolean {
  if (!username) return false;
  if (row.createdBy === username) return true;
  return accessLevel === "admin" || accessLevel === "owner";
}

export default function TacticalTerrainMap() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const mobileShell = useIsMobile();
  const [mapKey, setMapKey] = useState<string>("");
  const [meta, setMeta] = useState<TerrainMeta | null>(null);
  /** Large maps (e.g. Anizay) ship huge GeoJSON; mobile Safari OOMs / hangs on full parse + bounds walk. */
  const [layers, setLayers] = useState(() =>
    typeof window !== "undefined" && matchesMobileShell()
      ? {
          water: false,
          roads: false,
          pois: false,
          contours: false,
          structures: false,
          grid: true,
        }
      : {
          water: true,
          roads: true,
          pois: true,
          contours: false,
          structures: false,
          grid: true,
        },
  );
  const [geo, setGeo] = useState<{
    water?: Fc;
    roads?: Fc;
    pois?: Fc;
    contours?: Fc;
    structures?: Fc;
  }>({});
  const [placeMode, setPlaceMode] = useState(false);
  const [pending, setPending] = useState<L.LatLng | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [symbolPickerOpen, setSymbolPickerOpen] = useState(false);
  const [cursorCoords, setCursorCoords] = useState<string | null>(null);
  const [lineDrawMode, setLineDrawMode] = useState(false);
  const [lineVertices, setLineVertices] = useState<[number, number][]>([]);
  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [lineForm, setLineForm] = useState({ label: "", color: "#38bdf8" });
  const [ringMode, setRingMode] = useState(false);
  const [ringDialogOpen, setRingDialogOpen] = useState(false);
  const [ringPending, setRingPending] = useState<L.LatLng | null>(null);
  const [ringForm, setRingForm] = useState({
    radiusMeters: "1000",
    label: "",
    color: "#a855f7",
  });
  const [buildingMode, setBuildingMode] = useState(false);
  const [buildingDialogOpen, setBuildingDialogOpen] = useState(false);
  const [buildingEdit, setBuildingEdit] = useState<{
    featureKey: string;
    label: string;
    fillColor: string;
    strokeColor: string;
    rowId?: number;
  } | null>(null);
  const [form, setForm] = useState<{
    affiliation: TacAffiliation;
    markerType: string;
    label: string;
    useCustomSidc: boolean;
    customSidc: string;
  }>({
    affiliation: "friendly",
    markerType: "unit",
    label: "",
    useCustomSidc: false,
    customSidc: "",
  });

  const natoCatalogRows = useMemo(() => {
    const legacy = [
      {
        value: "unit",
        label: "Shortcut · Infantry",
        dimension: "Shortcuts",
        search: "unit infantry shortcut",
      },
      {
        value: "vehicle",
        label: "Shortcut · Mechanized / vehicle",
        dimension: "Shortcuts",
        search: "vehicle mechanized shortcut",
      },
      {
        value: "building",
        label: "Shortcut · Installation",
        dimension: "Shortcuts",
        search: "building installation shortcut",
      },
      {
        value: "equipment",
        label: "Shortcut · Equipment / supply",
        dimension: "Shortcuts",
        search: "equipment supply shortcut",
      },
    ];
    const rest = NATO_FRIENDLY_SIDCS.map((sidc) => {
      const sym = new ms.Symbol(sidc, { size: 14, fill: true });
      const meta = sym.getMetadata();
      const fid = meta.functionid ?? "";
      const dim = String(meta.dimension || "Symbol");
      const label = fid ? `${dim} · ${fid}` : sidc;
      return {
        value: sidc,
        label,
        dimension: dim,
        search: `${sidc} ${fid} ${dim}`.toLowerCase(),
      };
    });
    return [...legacy, ...rest];
  }, []);

  const symbolChoiceLabel = useMemo(() => {
    const row = natoCatalogRows.find((r) => r.value === form.markerType);
    return row?.label ?? form.markerType;
  }, [natoCatalogRows, form.markerType]);

  const catalogDimensions = useMemo(() => {
    const set = new Set(natoCatalogRows.map((r) => r.dimension));
    const preferred = [
      "Shortcuts",
      "Ground",
      "Air",
      "Sea Surface",
      "Sea Subsurface",
      "Space",
      "Activity",
      "Symbol",
    ];
    const head = preferred.filter((d) => set.has(d));
    const tail = Array.from(set)
      .filter((d) => !preferred.includes(d))
      .sort();
    return [...head, ...tail];
  }, [natoCatalogRows]);

  const { data: mapsPayload } = useQuery<{ maps: { id: string; label: string }[] }>({
    queryKey: ["/api/terrain/maps"],
    queryFn: () => apiRequest("GET", "/api/terrain/maps"),
  });

  const maps = mapsPayload?.maps ?? [];

  useEffect(() => {
    L.Map.mergeOptions({ tap: true });
  }, []);

  useEffect(() => {
    if (maps.length === 0 || mapKey) return;
    const saved = localStorage.getItem(TAC_MAP_STORAGE_KEY);
    if (saved && maps.some((m) => m.id === saved)) {
      setMapKey(saved);
      return;
    }
    setMapKey(maps[0].id);
  }, [maps, mapKey]);

  useEffect(() => {
    if (mapKey) localStorage.setItem(TAC_MAP_STORAGE_KEY, mapKey);
  }, [mapKey]);

  useEffect(() => {
    if (!mapKey) {
      setMeta(null);
      return;
    }
    let cancelled = false;
    fetch(`/terrain-data/${encodeURIComponent(mapKey)}_metadata.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: TerrainMeta | null) => {
        if (!cancelled && j) setMeta(j);
      })
      .catch(() => {
        if (!cancelled) setMeta(null);
      });
    return () => {
      cancelled = true;
    };
  }, [mapKey]);

  useEffect(() => {
    setGeo({});
  }, [mapKey]);

  useEffect(() => {
    setLineDrawMode(false);
    setLineVertices([]);
    setLineDialogOpen(false);
    setRingMode(false);
    setRingDialogOpen(false);
    setRingPending(null);
    setRingForm({ radiusMeters: "1000", label: "", color: "#a855f7" });
    setBuildingMode(false);
    setBuildingDialogOpen(false);
    setBuildingEdit(null);
  }, [mapKey]);

  const fetchLayer = useCallback(async (fileSuffix: string): Promise<Fc | null> => {
    if (!mapKey) return null;
    const r = await fetch(`/terrain-data/${encodeURIComponent(mapKey)}_${fileSuffix}`);
    if (!r.ok) return null;
    return (await r.json()) as Fc;
  }, [mapKey]);

  useEffect(() => {
    if (!mapKey || !layers.water) return;
    let cancel = false;
    void fetchLayer("water.geojson").then((data) => {
      if (!cancel && data) setGeo((g) => ({ ...g, water: data }));
    });
    return () => {
      cancel = true;
    };
  }, [mapKey, layers.water, fetchLayer]);

  useEffect(() => {
    if (!mapKey || !layers.roads) return;
    let cancel = false;
    void fetchLayer("roads.geojson").then((data) => {
      if (!cancel && data) setGeo((g) => ({ ...g, roads: data }));
    });
    return () => {
      cancel = true;
    };
  }, [mapKey, layers.roads, fetchLayer]);

  useEffect(() => {
    if (!mapKey || !layers.pois) return;
    let cancel = false;
    void fetchLayer("pois.geojson").then((data) => {
      if (!cancel && data) setGeo((g) => ({ ...g, pois: data }));
    });
    return () => {
      cancel = true;
    };
  }, [mapKey, layers.pois, fetchLayer]);

  useEffect(() => {
    if (!mapKey || !layers.contours) return;
    let cancel = false;
    void fetchLayer("contours.geojson").then((data) => {
      if (!cancel && data) setGeo((g) => ({ ...g, contours: data }));
    });
    return () => {
      cancel = true;
    };
  }, [mapKey, layers.contours, fetchLayer]);

  useEffect(() => {
    if (!mapKey || !layers.structures) return;
    let cancel = false;
    void fetchLayer("structures.geojson").then((data) => {
      if (!cancel && data) setGeo((g) => ({ ...g, structures: data }));
    });
    return () => {
      cancel = true;
    };
  }, [mapKey, layers.structures, fetchLayer]);

  /** World X/Z from exporter metadata (game meters). Leaflet CRS.Simple: lat = Z, lng = X. */
  const bounds = useMemo(() => {
    if (meta?.bounds?.min && meta?.bounds?.max) {
      const minX = Number(meta.bounds.min[0] ?? 0);
      const minZ = Number(meta.bounds.min[2] ?? 0);
      const maxX = Number(meta.bounds.max[0] ?? minX + 8192);
      const maxZ = Number(meta.bounds.max[2] ?? minZ + 8192);
      const sw = L.latLng(minZ, minX);
      const ne = L.latLng(maxZ, maxX);
      return L.latLngBounds(sw, ne);
    }
    const maxX = meta?.size?.x ?? 8192;
    const maxZ = meta?.size?.z ?? 8192;
    const mx = Math.max(256, maxX);
    const mz = Math.max(256, maxZ);
    return L.latLngBounds(L.latLng(0, 0), L.latLng(mz, mx));
  }, [meta]);

  /**
   * Union metadata bounds with loaded GeoJSON extents (desktop).
   * On mobile, skip walking GeoJSON — large exports (Anizay) freeze the main thread for seconds.
   */
  const combinedBounds = useMemo(() => {
    const b = L.latLngBounds(bounds.getSouthWest(), bounds.getNorthEast());
    if (!mobileShell) {
      extendBoundsFromGeoJSON(geo.water, b);
      extendBoundsFromGeoJSON(geo.roads, b);
      extendBoundsFromGeoJSON(geo.pois, b);
      extendBoundsFromGeoJSON(geo.contours, b);
      extendBoundsFromGeoJSON(geo.structures, b);
    }
    if (!b.isValid()) return bounds;
    return b;
  }, [
    bounds,
    mobileShell,
    geo.water,
    geo.roads,
    geo.pois,
    geo.contours,
    geo.structures,
  ]);

  const { data: markers = [], isLoading: markersLoading } = useQuery<TacticalMapMarker[]>({
    queryKey: ["/api/tactical-markers", mapKey],
    queryFn: () =>
      apiRequest("GET", `/api/tactical-markers?mapKey=${encodeURIComponent(mapKey)}`),
    enabled: !!mapKey,
  });

  const { data: lines = [], isLoading: linesLoading } = useQuery<TacticalMapLine[]>({
    queryKey: ["/api/tactical-lines", mapKey],
    queryFn: () =>
      apiRequest("GET", `/api/tactical-lines?mapKey=${encodeURIComponent(mapKey)}`),
    enabled: !!mapKey,
  });

  const { data: rangeRings = [], isLoading: ringsLoading } = useQuery<TacticalMapRangeRing[]>({
    queryKey: ["/api/tactical-range-rings", mapKey],
    queryFn: () =>
      apiRequest("GET", `/api/tactical-range-rings?mapKey=${encodeURIComponent(mapKey)}`),
    enabled: !!mapKey,
  });

  const { data: buildingLabels = [], isLoading: buildingLabelsLoading } = useQuery<
    TacticalMapBuildingLabel[]
  >({
    queryKey: ["/api/tactical-building-labels", mapKey],
    queryFn: () =>
      apiRequest("GET", `/api/tactical-building-labels?mapKey=${encodeURIComponent(mapKey)}`),
    enabled: !!mapKey,
  });

  const buildingOverlayByKey = useMemo(() => {
    const m = new Map<string, TacticalMapBuildingLabel>();
    for (const b of buildingLabels) m.set(b.featureKey, b);
    return m;
  }, [buildingLabels]);

  const createMut = useMutation({
    mutationFn: (body: {
      mapKey: string;
      gameX: number;
      gameZ: number;
      markerType: string;
      affiliation: TacAffiliation;
      label: string;
      customSidc?: string;
    }) => apiRequest("POST", "/api/tactical-markers", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/tactical-markers", mapKey] });
      setDialogOpen(false);
      setPending(null);
      setForm((f) => ({
        ...f,
        label: "",
        useCustomSidc: false,
        customSidc: "",
      }));
      setPlaceMode(false);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/tactical-markers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/tactical-markers", mapKey] }),
  });

  const updateMarkerPosMut = useMutation({
    mutationFn: (body: { id: number; gameX: number; gameZ: number }) =>
      apiRequest("PATCH", `/api/tactical-markers/${body.id}`, {
        gameX: body.gameX,
        gameZ: body.gameZ,
      }),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: ["/api/tactical-markers", mapKey] });
      const prev = qc.getQueryData<TacticalMapMarker[]>(["/api/tactical-markers", mapKey]);
      if (prev) {
        qc.setQueryData<TacticalMapMarker[]>(
          ["/api/tactical-markers", mapKey],
          prev.map((m) =>
            m.id === body.id ? { ...m, gameX: body.gameX, gameZ: body.gameZ } : m,
          ),
        );
      }
      return { prev };
    },
    onError: (_err, _body, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(["/api/tactical-markers", mapKey], ctx.prev);
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["/api/tactical-markers", mapKey] }),
  });

  const createLineMut = useMutation({
    mutationFn: (body: {
      mapKey: string;
      points: [number, number][];
      label: string;
      color: string;
    }) => apiRequest("POST", "/api/tactical-lines", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/tactical-lines", mapKey] });
      setLineDialogOpen(false);
      setLineVertices([]);
      setLineDrawMode(false);
      setLineForm({ label: "", color: "#38bdf8" });
    },
  });

  const deleteLineMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/tactical-lines/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/tactical-lines", mapKey] }),
  });

  const createRingMut = useMutation({
    mutationFn: (body: {
      mapKey: string;
      centerX: number;
      centerZ: number;
      radiusMeters: number;
      label: string;
      color: string;
    }) => apiRequest("POST", "/api/tactical-range-rings", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/tactical-range-rings", mapKey] });
      setRingDialogOpen(false);
      setRingPending(null);
      setRingMode(false);
      setRingForm({ radiusMeters: "1000", label: "", color: "#a855f7" });
    },
  });

  const deleteRingMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/tactical-range-rings/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/tactical-range-rings", mapKey] }),
  });

  const upsertBuildingLabelMut = useMutation({
    mutationFn: (body: {
      mapKey: string;
      featureKey: string;
      label: string;
      fillColor: string;
      strokeColor: string;
    }) => apiRequest("POST", "/api/tactical-building-labels", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/tactical-building-labels", mapKey] });
      setBuildingDialogOpen(false);
      setBuildingEdit(null);
      setBuildingMode(false);
    },
  });

  const deleteBuildingLabelMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/tactical-building-labels/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/tactical-building-labels", mapKey] });
      setBuildingDialogOpen(false);
      setBuildingEdit(null);
    },
  });

  const onMapPlaceClick = (ll: L.LatLng) => {
    setPending(ll);
    setDialogOpen(true);
  };

  const onMapLineClick = (ll: L.LatLng) => {
    setLineVertices((v) => [...v, [ll.lng, ll.lat]]);
  };

  const onMapRingClick = (ll: L.LatLng) => {
    setRingPending(ll);
    setRingDialogOpen(true);
  };

  const onBuildingMapClick = useCallback(
    (ll: L.LatLng) => {
      if (!layers.structures || !geo.structures) {
        toast({
          title: "Enable Structures",
          description: "Turn on the Structures map layer, then click a building footprint.",
          variant: "destructive",
        });
        return;
      }
      const hit = findBuildingFeatureAt(
        geo.structures as { type: "FeatureCollection"; features: unknown[] },
        ll.lng,
        ll.lat,
      );
      if (!hit) {
        toast({
          title: "No building here",
          description: "Click inside a structure polygon from the terrain export.",
          variant: "destructive",
        });
        return;
      }
      const existing = buildingOverlayByKey.get(hit.featureKey);
      setBuildingEdit({
        featureKey: hit.featureKey,
        label: existing?.label ?? "",
        fillColor: existing?.fillColor ?? "#64748b",
        strokeColor: existing?.strokeColor ?? "#94a3b8",
        rowId: existing?.id,
      });
      setBuildingDialogOpen(true);
    },
    [layers.structures, geo.structures, buildingOverlayByKey, toast],
  );

  const submitBuildingLabel = () => {
    if (!buildingEdit || !mapKey) return;
    upsertBuildingLabelMut.mutate({
      mapKey,
      featureKey: buildingEdit.featureKey,
      label: buildingEdit.label.trim(),
      fillColor: buildingEdit.fillColor,
      strokeColor: buildingEdit.strokeColor,
    });
  };

  const submitRangeRing = () => {
    if (!ringPending || !mapKey) return;
    const r = Number(ringForm.radiusMeters);
    if (!Number.isFinite(r) || r < 1 || r > 500_000) {
      toast({
        title: "Invalid radius",
        description: "Enter radius in meters (1–500000).",
        variant: "destructive",
      });
      return;
    }
    createRingMut.mutate({
      mapKey,
      centerX: ringPending.lng,
      centerZ: ringPending.lat,
      radiusMeters: r,
      label: ringForm.label.trim(),
      color: ringForm.color,
    });
  };

  const submitMarker = () => {
    if (!pending || !mapKey) return;
    const custom =
      form.useCustomSidc && form.customSidc.trim().length === 15
        ? form.customSidc.trim().toUpperCase()
        : undefined;
    if (form.useCustomSidc) {
      const u = form.customSidc.trim().toUpperCase();
      if (u.length !== 15 || !/^S[F][A-Z0-9*\-]{13}$/.test(u)) {
        toast({
          title: "Invalid custom SIDC",
          description: "Use 15 characters with 2nd letter F (friendly template).",
          variant: "destructive",
        });
        return;
      }
      const sym = new ms.Symbol(u, { size: 20, fill: true });
      if (!sym.isValid()) {
        toast({
          title: "Unsupported SIDC",
          description: "milsymbol rejected this code.",
          variant: "destructive",
        });
        return;
      }
    }
    createMut.mutate({
      mapKey,
      gameX: pending.lng,
      gameZ: pending.lat,
      markerType: form.markerType,
      affiliation: form.affiliation,
      label: form.label,
      customSidc: custom,
    });
  };

  const previewSidc = useMemo(() => {
    if (form.useCustomSidc) {
      const u = form.customSidc.trim().toUpperCase();
      if (u.length === 15 && /^S[F][A-Z0-9*\-]{13}$/.test(u)) {
        const sym = new ms.Symbol(u, { size: 36, fill: true });
        if (sym.isValid()) return sidcForAffiliation(u, form.affiliation);
      }
    }
    return (
      resolveMarkerSidc(form.affiliation, form.markerType) ?? "SUGPUCI---****U"
    );
  }, [
    form.useCustomSidc,
    form.customSidc,
    form.affiliation,
    form.markerType,
  ]);

  const submitLine = () => {
    if (!mapKey || lineVertices.length < 2) return;
    createLineMut.mutate({
      mapKey,
      points: lineVertices,
      label: lineForm.label.trim(),
      color: lineForm.color,
    });
  };

  const currentLabel = maps.find((m) => m.id === mapKey)?.label ?? mapKey;

  const layerToggles = (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] items-center">
      <LayerToggle id="water" label="Water" checked={layers.water} onChange={(v) => setLayers((l) => ({ ...l, water: v }))} />
      <LayerToggle id="roads" label="Roads" checked={layers.roads} onChange={(v) => setLayers((l) => ({ ...l, roads: v }))} />
      <LayerToggle id="pois" label="POIs" checked={layers.pois} onChange={(v) => setLayers((l) => ({ ...l, pois: v }))} />
      <LayerToggle id="contours" label="Contours" checked={layers.contours} onChange={(v) => setLayers((l) => ({ ...l, contours: v }))} />
      <LayerToggle id="grid" label="Grid & coords" checked={layers.grid} onChange={(v) => setLayers((l) => ({ ...l, grid: v }))} />
      <div className="flex items-center gap-2">
        <Checkbox
          id="structures"
          checked={layers.structures}
          onCheckedChange={(c) => setLayers((l) => ({ ...l, structures: c === true }))}
        />
        <label htmlFor="structures" className="flex items-center gap-1 cursor-pointer">
          Structures
          <span title="Large file — may be slow">
            <AlertTriangle className="h-3 w-3 text-amber-500" aria-hidden />
          </span>
        </label>
      </div>
    </div>
  );

  if (!maps.length) {
    return (
      <div className="p-4 tac-page space-y-2">
        <h1 className="text-sm font-bold tracking-[0.15em]" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
          TACTICAL TERRAIN
        </h1>
        <p className="text-xs text-muted-foreground max-w-lg">
          No terrain export found. Run the TDL Terrain Data Exporter in Arma Reforger Workbench (see{" "}
          <code className="text-[10px]">AG0_TDLTerrainExporterPlugin.c</code>) into{" "}
          <code className="text-[10px]">TDL_TerrainExport/TDL_TerrainExport/</code>, then restart the server.
        </p>
      </div>
    );
  }

  return (
    <div className="p-0 md:p-4 tac-page flex flex-col gap-0 md:gap-3 min-h-0 flex-1 -mx-0">
      {/* Sticky map switcher — full width on mobile */}
      <div className="sticky top-0 z-20 shrink-0 border-b border-border bg-card/95 backdrop-blur-md supports-[backdrop-filter]:bg-card/80 px-3 py-2.5 md:rounded-t-lg md:border md:border-b-0 md:mx-0 space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground tracking-wider">
              <MapPinned className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              <span className="truncate">LIVE · Each map keeps its own markers</span>
            </div>
            <Label htmlFor="tac-map-select" className="sr-only">
              Select terrain map
            </Label>
            <Select value={mapKey} onValueChange={setMapKey}>
              <SelectTrigger
                id="tac-map-select"
                className="h-11 w-full sm:h-10 sm:max-w-md text-sm font-mono touch-manipulation"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Layers className="h-4 w-4 text-blue-400 shrink-0" />
                  <SelectValue placeholder="Select map" />
                </div>
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-[min(70dvh,320px)]">
                {maps.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-sm font-mono py-3 sm:py-2">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:shrink-0">
            <Button
              type="button"
              size="sm"
              variant={placeMode ? "default" : "outline"}
              className="h-11 sm:h-9 w-full sm:w-auto text-[11px] tracking-wider touch-manipulation"
              onClick={() => {
                setLineDrawMode(false);
                setLineVertices([]);
                setRingMode(false);
                setRingPending(null);
                setBuildingMode(false);
                setPlaceMode((p) => !p);
                if (placeMode) setPending(null);
              }}
            >
              {placeMode ? "TAP MAP TO PLACE" : "PLACE MARKER"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={lineDrawMode ? "default" : "outline"}
              className="h-11 sm:h-9 w-full sm:w-auto text-[11px] tracking-wider touch-manipulation gap-1.5"
              onClick={() => {
                setPlaceMode(false);
                setPending(null);
                setRingMode(false);
                setRingPending(null);
                setBuildingMode(false);
                setLineDrawMode((d) => {
                  if (d) setLineVertices([]);
                  return !d;
                });
              }}
            >
              <PenLine className="h-3.5 w-3.5" />
              {lineDrawMode ? "DRAWING LINE" : "DRAW LINE"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={ringMode ? "default" : "outline"}
              className="h-11 sm:h-9 w-full sm:w-auto text-[11px] tracking-wider touch-manipulation gap-1.5"
              onClick={() => {
                setPlaceMode(false);
                setPending(null);
                setLineDrawMode(false);
                setLineVertices([]);
                setBuildingMode(false);
                setRingMode((r) => !r);
                if (ringMode) setRingPending(null);
              }}
            >
              <Target className="h-3.5 w-3.5" />
              {ringMode ? "TAP CENTER FOR RING" : "RANGE RING"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={buildingMode ? "default" : "outline"}
              className="h-11 sm:h-9 w-full sm:w-auto text-[11px] tracking-wider touch-manipulation gap-1.5"
              onClick={() => {
                setPlaceMode(false);
                setPending(null);
                setLineDrawMode(false);
                setLineVertices([]);
                setRingMode(false);
                setRingPending(null);
                setBuildingMode((b) => !b);
              }}
            >
              <Building2 className="h-3.5 w-3.5" />
              {buildingMode ? "TAP BUILDING" : "LABEL BUILDING"}
            </Button>
          </div>
        </div>
        <p className="text-[9px] text-muted-foreground leading-snug">
          Active: <span className="text-foreground font-mono">{currentLabel}</span>
          {" · "}
          Building labels are shared on this terrain · enable Structures to pick footprints · game X/Z (m).
        </p>
      </div>

      <div className="px-3 md:px-0 space-y-2 md:space-y-3 flex flex-col flex-1 min-h-0">
        <div className="hidden md:block shrink-0 border border-border rounded-md p-2 bg-card/50">
          {layerToggles}
        </div>
        <Collapsible className="md:hidden shrink-0 border border-border rounded-md bg-card/50 overflow-hidden">
          <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[11px] font-bold tracking-widest text-muted-foreground touch-manipulation">
            <span className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              MAP LAYERS
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="px-3 pb-3 pt-0 border-t border-border/60 space-y-2">
            <p className="text-[9px] text-muted-foreground leading-snug pt-2">
              On phones, terrain layers start off — large maps (e.g. Anizay) can overload the browser. Enable water, roads, or POIs one at a time.
            </p>
            {layerToggles}
          </CollapsibleContent>
        </Collapsible>

        <div className="flex flex-col lg:flex-row gap-3 flex-1 min-h-0 pb-2 md:pb-0">
          <div
            className={`flex-1 rounded border border-border overflow-hidden relative z-0 ${
              mobileShell
                ? "min-h-[max(280px,min(58dvh,560px))]"
                : "min-h-[420px] lg:min-h-[min(70dvh,720px)]"
            }`}
          >
          {mapKey ? (
            <>
            <MapContainer
              key={mapKey}
              crs={L.CRS.Simple}
              bounds={combinedBounds}
              boundsOptions={{ padding: [28, 28] }}
              minZoom={-10}
              maxZoom={12}
              zoomSnap={0.25}
              className="h-full w-full min-h-[inherit] [&.leaflet-container]:bg-[hsl(150_15%_10%)] [&.leaflet-container]:outline-none"
              style={{
                minHeight: mobileShell ? "max(280px, min(58dvh, 560px))" : 420,
              }}
              zoomControl
            >
              <InvalidateMapSizeOnResize />
              <FitBoundsDebouncedOncePerMap
                mapKey={mapKey}
                bounds={combinedBounds}
                padFraction={0.06}
                debounceMs={900}
              />
              <GameGridOverlay enabled={layers.grid} />
              <MapCursorCoords onCoords={setCursorCoords} />
              <MapInteractionHandler
                placeEnabled={placeMode}
                lineEnabled={lineDrawMode}
                ringEnabled={ringMode}
                buildingEnabled={buildingMode}
                onPlaceClick={onMapPlaceClick}
                onLineClick={onMapLineClick}
                onRingClick={onMapRingClick}
                onBuildingClick={onBuildingMapClick}
              />
              {rangeRings.map((rr) => (
                <Polygon
                  key={rr.id}
                  positions={rangeRingLatLngs(rr.centerX, rr.centerZ, rr.radiusMeters)}
                  pathOptions={{
                    color: rr.color,
                    weight: 2,
                    opacity: 0.92,
                    fillColor: rr.color,
                    fillOpacity: 0.07,
                  }}
                  interactive={false}
                />
              ))}
              {lines.map((ln) => (
                <Polyline
                  key={ln.id}
                  positions={ln.points.map(([x, z]) => [z, x] as L.LatLngTuple)}
                  pathOptions={{
                    color: ln.color,
                    weight: 3,
                    opacity: 0.92,
                  }}
                />
              ))}
              {lineVertices.length >= 2 ? (
                <Polyline
                  positions={lineVertices.map(([x, z]) => [z, x] as L.LatLngTuple)}
                  pathOptions={{
                    color: lineForm.color,
                    weight: 3,
                    opacity: 0.85,
                    dashArray: "8 6",
                  }}
                />
              ) : null}
              {geo.water && layers.water ? (
                <GeoJSON
                  data={geo.water}
                  coordsToLatLng={gameCoordsToLatLng}
                  style={() => ({
                    color: "#1d4ed8",
                    weight: 1,
                    fillColor: "#2563eb",
                    fillOpacity: 0.28,
                  })}
                />
              ) : null}
              {geo.roads && layers.roads ? (
                <GeoJSON
                  data={geo.roads}
                  coordsToLatLng={gameCoordsToLatLng}
                  style={() => ({ color: "#a16207", weight: 1.5, opacity: 0.85 })}
                />
              ) : null}
              {geo.contours && layers.contours ? (
                <GeoJSON
                  data={geo.contours}
                  coordsToLatLng={gameCoordsToLatLng}
                  style={() => ({ color: "rgba(74,222,128,0.35)", weight: 0.8 })}
                />
              ) : null}
              {geo.structures && layers.structures ? (
                <GeoJSON
                  key={`str-${mapKey}-${buildingLabels.length}`}
                  data={geo.structures}
                  coordsToLatLng={gameCoordsToLatLng}
                  style={(feature) => {
                    const key = stableFeatureKey(feature as GeoJsonFeatureLike);
                    const ov = buildingOverlayByKey.get(key);
                    return {
                      color: ov?.strokeColor ?? "rgba(148,163,184,0.5)",
                      weight: ov ? 1.2 : 0.5,
                      fillColor: ov?.fillColor ?? "rgba(148,163,184,0.45)",
                      fillOpacity: ov ? 0.4 : 0.08,
                    };
                  }}
                  onEachFeature={(feature, layer) => {
                    layer.unbindTooltip();
                    const key = stableFeatureKey(feature as GeoJsonFeatureLike);
                    const ov = buildingOverlayByKey.get(key);
                    const t = ov?.label?.trim();
                    if (t) {
                      layer.bindTooltip(t, {
                        permanent: true,
                        direction: "center",
                        className: "tac-building-tooltip",
                      });
                    }
                  }}
                />
              ) : null}
              {geo.pois && layers.pois ? (
                <GeoJSON
                  data={geo.pois}
                  coordsToLatLng={gameCoordsToLatLng}
                  pointToLayer={(_f, latlng) =>
                    L.circleMarker(latlng, {
                      radius: 3,
                      color: "#14532d",
                      weight: 1,
                      fillColor: "#4ade80",
                      fillOpacity: 0.7,
                    })
                  }
                />
              ) : null}
              {markers.map((m) => {
                const canMove = canDragMarker(user?.username);
                const cap = tacMarkerCaption(m, natoCatalogRows);
                return (
                  <Marker
                    key={m.id}
                    position={[m.gameZ, m.gameX]}
                    icon={makeNatoDivIcon(m.sidc, m.label)}
                    zIndexOffset={800}
                    draggable={canMove}
                    eventHandlers={
                      canMove
                        ? {
                            dragend: (e) => {
                              const ll = e.target.getLatLng();
                              updateMarkerPosMut.mutate({
                                id: m.id,
                                gameX: ll.lng,
                                gameZ: ll.lat,
                              });
                            },
                          }
                        : undefined
                    }
                  >
                    <Tooltip
                      permanent
                      direction="top"
                      offset={[0, -6]}
                      opacity={1}
                      className="tac-marker-tooltip !border-border/80 !bg-black/88 !px-1.5 !py-0.5 !text-[9px] !font-mono !text-blue-100 !shadow-md"
                    >
                      {cap}
                    </Tooltip>
                  </Marker>
                );
              })}
            </MapContainer>
            {lineDrawMode ? (
              <div className="pointer-events-auto absolute top-2 left-2 right-2 z-[600] flex flex-wrap items-center gap-2 rounded-md border border-border bg-card/95 px-2 py-2 shadow-md backdrop-blur-sm">
                <span className="text-[10px] font-mono text-muted-foreground">
                  Line · {lineVertices.length} point{lineVertices.length === 1 ? "" : "s"}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 text-[10px]"
                  disabled={lineVertices.length === 0}
                  onClick={() => setLineVertices((v) => v.slice(0, -1))}
                >
                  <Undo2 className="h-3 w-3 mr-1" />
                  Undo
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-[10px]"
                  disabled={lineVertices.length < 2}
                  onClick={() => {
                    if (lineVertices.length < 2) {
                      toast({
                        title: "Need at least 2 points",
                        description: "Tap the map to add vertices.",
                        variant: "destructive",
                      });
                    } else {
                      setLineDialogOpen(true);
                    }
                  }}
                >
                  Finish line
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-[10px] ml-auto"
                  onClick={() => {
                    setLineDrawMode(false);
                    setLineVertices([]);
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : null}
            {ringMode ? (
              <div className="pointer-events-auto absolute top-2 left-2 right-2 z-[600] flex flex-wrap items-center gap-2 rounded-md border border-border bg-card/95 px-2 py-2 shadow-md backdrop-blur-sm">
                <span className="text-[10px] font-mono text-muted-foreground">
                  Tap map for ring center · set radius in dialog (meters)
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-[10px] ml-auto"
                  onClick={() => {
                    setRingMode(false);
                    setRingPending(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : null}
            {buildingMode ? (
              <div className="pointer-events-auto absolute top-2 left-2 right-2 z-[600] flex flex-wrap items-center gap-2 rounded-md border border-border bg-card/95 px-2 py-2 shadow-md backdrop-blur-sm">
                <span className="text-[10px] font-mono text-muted-foreground">
                  Structures on · tap inside a building footprint to label &amp; color (shared on this map)
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-[10px] ml-auto"
                  onClick={() => setBuildingMode(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : null}
            </>
          ) : null}
          {mapKey ? (
            <div
              className={`pointer-events-none absolute bottom-2 left-2 z-[500] rounded border border-border/60 bg-black/70 px-2 py-1 font-mono text-[9px] text-blue-400/95 shadow-sm max-w-[min(100%,22rem)] ${
                layers.grid ? "" : "opacity-90"
              }`}
              aria-live="polite"
            >
              {layers.grid
                ? cursorCoords ?? "Move pointer — grid spacing follows zoom (meters)"
                : cursorCoords ?? "Enable “Grid & coords” for overlay"}
            </div>
          ) : null}
        </div>

        <div
          className={`w-full lg:w-[300px] shrink-0 flex flex-col gap-3 border border-border rounded-md bg-card/40 p-2 overflow-hidden ${
            mobileShell ? "max-h-[40dvh] min-h-[160px]" : "max-h-[50vh] lg:max-h-none"
          }`}
        >
          <div>
            <div className="text-[10px] font-bold tracking-widest text-muted-foreground px-0.5">
              MARKERS · {currentLabel}
            </div>
            <div className="text-[9px] text-muted-foreground px-0.5">
              {markersLoading ? "Loading…" : `${markers.length} on this map`}
            </div>
            <div className="mt-1 max-h-[min(28dvh,240px)] lg:max-h-[min(32dvh,280px)] overflow-y-auto overscroll-contain space-y-1.5 pr-1 -mr-1 touch-pan-y">
              {markers.map((m) => {
                const canDel = canDeleteMarker(m, user?.username, user?.accessLevel);
                return (
                  <div
                    key={m.id}
                    className="flex items-start gap-2 text-[10px] border border-border/60 rounded p-2 bg-background/50"
                  >
                    <div
                      className="shrink-0 w-9 h-9 flex items-center justify-center overflow-hidden"
                      dangerouslySetInnerHTML={{
                        __html: symbolSvg(m.sidc, 24, m.label),
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-blue-400/90 truncate">
                        {m.label || (m.markerType.startsWith("custom:") ? "Custom SIDC" : m.markerType)}
                      </div>
                      <div className="text-muted-foreground text-[9px]">
                        {affiliationUiLabel(m.affiliation)} · {m.createdBy}
                      </div>
                      <div className="text-[9px] text-muted-foreground/80 font-mono">
                        X {m.gameX.toFixed(0)} · Z {m.gameZ.toFixed(0)}
                      </div>
                    </div>
                    {canDel ? (
                      <button
                        type="button"
                        className="shrink-0 p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-muted-foreground hover:text-red-400 touch-manipulation rounded-md hover:bg-red-950/20"
                        title={
                          m.createdBy === user?.username
                            ? "Remove your marker"
                            : "Remove (admin/owner)"
                        }
                        onClick={() => deleteMut.mutate(m.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <span className="shrink-0 w-10" aria-hidden />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-border/60 pt-2">
            <div className="text-[10px] font-bold tracking-widest text-muted-foreground px-0.5">
              RANGE RINGS · {currentLabel}
            </div>
            <div className="text-[9px] text-muted-foreground px-0.5">
              {ringsLoading ? "Loading…" : `${rangeRings.length} rings (m)`}
            </div>
            <div className="mt-1 max-h-[min(20dvh,200px)] lg:max-h-[min(24dvh,220px)] overflow-y-auto overscroll-contain space-y-1.5 pr-1 -mr-1 touch-pan-y">
              {rangeRings.map((rr) => {
                const canDel = canDeleteRangeRing(rr, user?.username, user?.accessLevel);
                return (
                  <div
                    key={rr.id}
                    className="flex items-center gap-2 text-[10px] border border-border/60 rounded p-2 bg-background/50"
                  >
                    <div
                      className="shrink-0 w-6 h-6 rounded-full border-2 border-dashed"
                      style={{ borderColor: rr.color }}
                      title={rr.color}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-purple-300/90 truncate">
                        {rr.label || `Ring ${rr.radiusMeters.toFixed(0)} m`}
                      </div>
                      <div className="text-muted-foreground text-[9px]">
                        r={rr.radiusMeters.toFixed(0)} m · {rr.createdBy}
                      </div>
                    </div>
                    {canDel ? (
                      <button
                        type="button"
                        className="shrink-0 p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-muted-foreground hover:text-red-400 touch-manipulation rounded-md hover:bg-red-950/20"
                        title="Remove range ring"
                        onClick={() => deleteRingMut.mutate(rr.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <span className="shrink-0 w-10" aria-hidden />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-border/60 pt-2">
            <div className="text-[10px] font-bold tracking-widest text-muted-foreground px-0.5">
              BUILDINGS · {currentLabel}
            </div>
            <div className="text-[9px] text-muted-foreground px-0.5">
              {buildingLabelsLoading ? "Loading…" : `${buildingLabels.length} labeled`}
            </div>
            <div className="mt-1 max-h-[min(18dvh,180px)] lg:max-h-[min(22dvh,200px)] overflow-y-auto overscroll-contain space-y-1.5 pr-1 -mr-1 touch-pan-y">
              {buildingLabels.map((bl) => {
                const canDel = canDeleteBuildingLabel(bl, user?.username, user?.accessLevel);
                return (
                  <div
                    key={bl.id}
                    className="flex items-center gap-2 text-[10px] border border-border/60 rounded p-2 bg-background/50"
                  >
                    <div
                      className="shrink-0 w-6 h-6 rounded border"
                      style={{
                        borderColor: bl.strokeColor,
                        backgroundColor: bl.fillColor,
                      }}
                      title={`${bl.fillColor} / ${bl.strokeColor}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-amber-200/90 truncate">
                        {bl.label?.trim() || "(no label)"}
                      </div>
                      <div className="text-muted-foreground text-[9px] truncate font-mono">
                        {bl.createdBy}
                      </div>
                    </div>
                    {canDel ? (
                      <button
                        type="button"
                        className="shrink-0 p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-muted-foreground hover:text-red-400 touch-manipulation rounded-md hover:bg-red-950/20"
                        title="Remove building label"
                        onClick={() => deleteBuildingLabelMut.mutate(bl.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <span className="shrink-0 w-10" aria-hidden />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-border/60 pt-2">
            <div className="text-[10px] font-bold tracking-widest text-muted-foreground px-0.5">
              LINES · {currentLabel}
            </div>
            <div className="text-[9px] text-muted-foreground px-0.5">
              {linesLoading ? "Loading…" : `${lines.length} polylines`}
            </div>
            <div className="mt-1 max-h-[min(22dvh,200px)] lg:max-h-[min(26dvh,220px)] overflow-y-auto overscroll-contain space-y-1.5 pr-1 -mr-1 touch-pan-y">
              {lines.map((ln) => {
                const canDel = canDeleteLine(ln, user?.username, user?.accessLevel);
                return (
                  <div
                    key={ln.id}
                    className="flex items-center gap-2 text-[10px] border border-border/60 rounded p-2 bg-background/50"
                  >
                    <div
                      className="shrink-0 w-6 h-1 rounded-sm"
                      style={{ backgroundColor: ln.color }}
                      title={ln.color}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sky-400/90 truncate">
                        {ln.label || `Line (${ln.points.length} pts)`}
                      </div>
                      <div className="text-muted-foreground text-[9px]">{ln.createdBy}</div>
                    </div>
                    {canDel ? (
                      <button
                        type="button"
                        className="shrink-0 p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-muted-foreground hover:text-red-400 touch-manipulation rounded-md hover:bg-red-950/20"
                        title="Remove line"
                        onClick={() => deleteLineMut.mutate(ln.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <span className="shrink-0 w-10" aria-hidden />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-w-md"
          onPointerDownOutside={(e) => {
            const t = e.target as HTMLElement;
            if (
              t.closest("[data-radix-popper-content-wrapper]") ||
              t.closest("[data-radix-popover-content]") ||
              t.closest("[data-radix-select-content]") ||
              t.closest("[data-radix-select-viewport]")
            ) {
              e.preventDefault();
            }
          }}
          onInteractOutside={(e) => {
            const t = e.target as HTMLElement;
            if (
              t.closest("[data-radix-popper-content-wrapper]") ||
              t.closest("[data-radix-popover-content]") ||
              t.closest("[data-radix-select-content]") ||
              t.closest("[data-radix-select-viewport]")
            ) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-sm tracking-wider">
              ADD MARKER (JOINT SYMBOLOGY)
            </DialogTitle>
          </DialogHeader>
          {pending && (
            <div className="text-[10px] text-muted-foreground font-mono">
              X {pending.lng.toFixed(1)} · Z {pending.lat.toFixed(1)}
            </div>
          )}
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label className="text-[10px]">AFFILIATION</Label>
              <Select
                value={form.affiliation}
                onValueChange={(v) => setForm((f) => ({ ...f, affiliation: v as TacAffiliation }))}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  <SelectItem value="friendly">Friendly (BLUFOR)</SelectItem>
                  <SelectItem value="hostile">Hostile (OPFOR)</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 rounded border border-border/60 px-2 py-1.5 bg-secondary/20">
              <Checkbox
                id="tac-custom-sidc"
                checked={form.useCustomSidc}
                onCheckedChange={(c) =>
                  setForm((f) => ({ ...f, useCustomSidc: c === true }))
                }
              />
              <label htmlFor="tac-custom-sidc" className="text-[10px] cursor-pointer leading-tight">
                Custom 15-char friendly-template SIDC (any valid milsymbol / APP-6C letter code)
              </label>
            </div>
            {form.useCustomSidc ? (
              <div className="space-y-1">
                <Label className="text-[10px] font-mono">SIDC (2nd char must be F)</Label>
                <Input
                  className="h-9 text-xs font-mono tracking-wider"
                  value={form.customSidc}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      customSidc: e.target.value.toUpperCase().slice(0, 15),
                    }))
                  }
                  placeholder="SFGPUCI---****F"
                  maxLength={15}
                />
              </div>
            ) : null}
            <div className="space-y-1">
              <Label className="text-[10px]">SYMBOL (catalog or shortcut)</Label>
              <Popover
                open={symbolPickerOpen}
                onOpenChange={setSymbolPickerOpen}
                modal={false}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={form.useCustomSidc}
                    className="h-9 w-full justify-between gap-2 px-2 font-normal"
                  >
                    <span className="truncate text-left text-[10px] leading-tight">
                      {symbolChoiceLabel}
                    </span>
                    <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="z-[200] w-[min(calc(100vw-2rem),440px)] p-0"
                  align="start"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <Command className="rounded-lg border-0">
                    <CommandInput placeholder="Search name, function ID, or SIDC…" className="h-9" />
                    <CommandList className="max-h-[min(55dvh,320px)]">
                      <CommandEmpty>No symbol matches.</CommandEmpty>
                      {catalogDimensions.map((dim) => (
                        <CommandGroup key={dim} heading={dim}>
                          {natoCatalogRows
                            .filter((r) => r.dimension === dim)
                            .map((r) => {
                              const iconSidc =
                                resolveMarkerSidc(form.affiliation, r.value) ??
                                "SUGPUCI---****U";
                              return (
                              <CommandItem
                                key={r.value}
                                value={`${r.label} ${r.value} ${r.search}`}
                                onSelect={() => {
                                  setForm((f) => ({ ...f, markerType: r.value }));
                                  setSymbolPickerOpen(false);
                                }}
                                className="gap-2 text-xs"
                              >
                                <span
                                  className="shrink-0 w-8 h-8 flex items-center justify-center overflow-hidden"
                                  dangerouslySetInnerHTML={{
                                    __html: symbolSvg(iconSidc, 22),
                                  }}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="truncate font-medium">{r.label}</div>
                                  <div className="truncate font-mono text-[9px] text-muted-foreground">
                                    {r.value}
                                  </div>
                                </div>
                              </CommandItem>
                            );
                            })}
                        </CommandGroup>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">
                DESIGNATION / BUILDING # (optional — drawn on symbol)
              </Label>
              <Input
                className="h-9 text-xs font-mono"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. 12 · BLDG A · OBJ BLUE"
              />
            </div>
            <div className="flex items-center gap-2 border border-border rounded p-2 bg-secondary/30">
              <div
                className="w-12 h-12 shrink-0 flex items-center justify-center"
                dangerouslySetInnerHTML={{
                  __html: symbolSvg(previewSidc, 36, form.label),
                }}
              />
              <div className="text-[9px] text-muted-foreground leading-snug">
                Preview uses your affiliation (BLUFOR/OPFOR/neutral/unknown). Catalog + custom SIDC are validated with milsymbol. Designation appears as APP-6 unique designation when supported.
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submitMarker} disabled={!pending || createMut.isPending}>
              PLACE
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={lineDialogOpen} onOpenChange={setLineDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm tracking-wider">SAVE LINE</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="text-[10px] text-muted-foreground font-mono">
              {lineVertices.length} vertices · game X/Z (m)
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">LABEL (OPTIONAL)</Label>
              <Input
                className="h-9 text-xs font-mono"
                value={lineForm.label}
                onChange={(e) => setLineForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Phase line · MSR · boundary…"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">COLOR</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  className="h-9 w-14 cursor-pointer border border-border p-1 bg-background"
                  value={lineForm.color}
                  onChange={(e) => setLineForm((f) => ({ ...f, color: e.target.value }))}
                />
                <Input
                  className="h-9 text-xs font-mono flex-1"
                  value={lineForm.color}
                  onChange={(e) => setLineForm((f) => ({ ...f, color: e.target.value }))}
                  placeholder="#38bdf8"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLineDialogOpen(false)}
            >
              Back
            </Button>
            <Button
              size="sm"
              onClick={submitLine}
              disabled={lineVertices.length < 2 || createLineMut.isPending}
            >
              SAVE LINE
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={ringDialogOpen}
        onOpenChange={(o) => {
          setRingDialogOpen(o);
          if (!o) setRingPending(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm tracking-wider">RANGE RING</DialogTitle>
          </DialogHeader>
          {ringPending && (
            <div className="text-[10px] text-muted-foreground font-mono">
              Center · X {ringPending.lng.toFixed(1)} · Z {ringPending.lat.toFixed(1)}
            </div>
          )}
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label className="text-[10px]">RADIUS (METERS)</Label>
              <Input
                className="h-9 text-xs font-mono"
                inputMode="numeric"
                value={ringForm.radiusMeters}
                onChange={(e) =>
                  setRingForm((f) => ({ ...f, radiusMeters: e.target.value }))
                }
                placeholder="1000"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">LABEL (OPTIONAL)</Label>
              <Input
                className="h-9 text-xs font-mono"
                value={ringForm.label}
                onChange={(e) => setRingForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Max effective · 155mm · danger close…"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">COLOR</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  className="h-9 w-14 cursor-pointer border border-border p-1 bg-background"
                  value={ringForm.color}
                  onChange={(e) => setRingForm((f) => ({ ...f, color: e.target.value }))}
                />
                <Input
                  className="h-9 text-xs font-mono flex-1"
                  value={ringForm.color}
                  onChange={(e) => setRingForm((f) => ({ ...f, color: e.target.value }))}
                  placeholder="#a855f7"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRingDialogOpen(false);
                setRingPending(null);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={submitRangeRing}
              disabled={!ringPending || createRingMut.isPending}
            >
              PLACE RING
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={buildingDialogOpen && !!buildingEdit}
        onOpenChange={(o) => {
          setBuildingDialogOpen(o);
          if (!o) setBuildingEdit(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm tracking-wider">BUILDING LABEL</DialogTitle>
          </DialogHeader>
          {buildingEdit && (
            <div className="grid gap-3">
              <div className="text-[9px] text-muted-foreground font-mono break-all">
                feature · {buildingEdit.featureKey}
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">LABEL</Label>
                <Input
                  className="h-9 text-xs font-mono"
                  value={buildingEdit.label}
                  onChange={(e) =>
                    setBuildingEdit((b) => (b ? { ...b, label: e.target.value } : b))
                  }
                  placeholder="HQ · OBJ ALPHA · cache…"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">FILL</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    className="h-9 w-14 cursor-pointer border border-border p-1 bg-background"
                    value={buildingEdit.fillColor}
                    onChange={(e) =>
                      setBuildingEdit((b) => (b ? { ...b, fillColor: e.target.value } : b))
                    }
                  />
                  <Input
                    className="h-9 text-xs font-mono flex-1"
                    value={buildingEdit.fillColor}
                    onChange={(e) =>
                      setBuildingEdit((b) => (b ? { ...b, fillColor: e.target.value } : b))
                    }
                    placeholder="#64748b"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">OUTLINE</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    className="h-9 w-14 cursor-pointer border border-border p-1 bg-background"
                    value={buildingEdit.strokeColor}
                    onChange={(e) =>
                      setBuildingEdit((b) => (b ? { ...b, strokeColor: e.target.value } : b))
                    }
                  />
                  <Input
                    className="h-9 text-xs font-mono flex-1"
                    value={buildingEdit.strokeColor}
                    onChange={(e) =>
                      setBuildingEdit((b) => (b ? { ...b, strokeColor: e.target.value } : b))
                    }
                    placeholder="#94a3b8"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setBuildingDialogOpen(false);
                setBuildingEdit(null);
              }}
            >
              Cancel
            </Button>
            {buildingEdit?.rowId != null &&
            (() => {
              const row = buildingLabels.find((b) => b.id === buildingEdit.rowId);
              return row && canDeleteBuildingLabel(row, user?.username, user?.accessLevel) ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteBuildingLabelMut.mutate(buildingEdit.rowId!)}
                  disabled={deleteBuildingLabelMut.isPending}
                >
                  Delete
                </Button>
              ) : null;
            })()}
            <Button
              size="sm"
              onClick={submitBuildingLabel}
              disabled={!buildingEdit || upsertBuildingLabelMut.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LayerToggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(c) => onChange(c === true)} />
      <label htmlFor={id} className="cursor-pointer">
        {label}
      </label>
    </div>
  );
}
