import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import L from "leaflet";
import { MapContainer, GeoJSON, Marker, useMapEvents } from "react-leaflet";
import ms from "milsymbol";
import "leaflet/dist/leaflet.css";

import { useAuth } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiRequest } from "@/lib/queryClient";
import type { TacticalMapMarker } from "@shared/schema";
import type { TacAffiliation, TacMarkerCategory } from "@shared/natoSidc";
import { sidcForMarker } from "@shared/natoSidc";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Layers, MapPinned, AlertTriangle, Trash2 } from "lucide-react";

function gameCoordsToLatLng(coords: number[]): L.LatLng {
  const x = coords[0];
  const z = coords[1] ?? coords[0];
  return L.latLng(z, x);
}

function makeNatoDivIcon(sidc: string): L.DivIcon {
  const sym = new ms.Symbol(sidc, { size: 30, fill: true });
  const { width, height } = sym.getSize();
  const anchor = sym.getAnchor();
  return L.divIcon({
    html: sym.asSVG(),
    className: "tac-nato-leaflet-icon",
    iconSize: [width, height],
    iconAnchor: [anchor.x, anchor.y],
  });
}

function MapClickHandler({
  enabled,
  onClick,
}: {
  enabled: boolean;
  onClick: (ll: L.LatLng) => void;
}) {
  useMapEvents({
    click(e) {
      if (enabled) onClick(e.latlng);
    },
  });
  return null;
}

interface TerrainMeta {
  name?: string;
  bounds?: { min: number[]; max: number[] };
  size?: { x: number; y: number; z: number };
}

type Fc = { type: "FeatureCollection"; features: unknown[] };

const TAC_MAP_STORAGE_KEY = "tacedge.tacMapKey";

function canDeleteMarker(
  m: TacticalMapMarker,
  username: string | undefined,
  role: string | undefined,
): boolean {
  if (!username) return false;
  if (m.createdBy === username) return true;
  return role === "admin" || role === "owner";
}

export default function TacticalTerrainMap() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const mobileShell = useIsMobile();
  const [mapKey, setMapKey] = useState<string>("");
  const [meta, setMeta] = useState<TerrainMeta | null>(null);
  const [layers, setLayers] = useState({
    water: true,
    roads: true,
    pois: true,
    contours: false,
    structures: false,
  });
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
  const [form, setForm] = useState<{
    affiliation: TacAffiliation;
    markerType: TacMarkerCategory;
    label: string;
  }>({ affiliation: "friendly", markerType: "unit", label: "" });

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

  const bounds = useMemo(() => {
    const maxX = meta?.bounds?.max?.[0] ?? meta?.size?.x ?? 8192;
    const maxZ = meta?.bounds?.max?.[2] ?? meta?.size?.z ?? 8192;
    const mx = Math.max(256, maxX);
    const mz = Math.max(256, maxZ);
    return L.latLngBounds(L.latLng(0, 0), L.latLng(mz, mx));
  }, [meta]);

  const { data: markers = [], isLoading: markersLoading } = useQuery<TacticalMapMarker[]>({
    queryKey: ["/api/tactical-markers", mapKey],
    queryFn: () =>
      apiRequest("GET", `/api/tactical-markers?mapKey=${encodeURIComponent(mapKey)}`),
    enabled: !!mapKey,
  });

  const createMut = useMutation({
    mutationFn: (body: {
      mapKey: string;
      gameX: number;
      gameZ: number;
      markerType: TacMarkerCategory;
      affiliation: TacAffiliation;
      label: string;
    }) => apiRequest("POST", "/api/tactical-markers", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/tactical-markers", mapKey] });
      setDialogOpen(false);
      setPending(null);
      setForm((f) => ({ ...f, label: "" }));
      setPlaceMode(false);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/tactical-markers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/tactical-markers", mapKey] }),
  });

  const onMapClick = (ll: L.LatLng) => {
    setPending(ll);
    setDialogOpen(true);
  };

  const submitMarker = () => {
    if (!pending || !mapKey) return;
    createMut.mutate({
      mapKey,
      gameX: pending.lng,
      gameZ: pending.lat,
      markerType: form.markerType,
      affiliation: form.affiliation,
      label: form.label,
    });
  };

  const previewSidc = sidcForMarker(form.affiliation, form.markerType);

  const currentLabel = maps.find((m) => m.id === mapKey)?.label ?? mapKey;

  const layerToggles = (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] items-center">
      <LayerToggle id="water" label="Water" checked={layers.water} onChange={(v) => setLayers((l) => ({ ...l, water: v }))} />
      <LayerToggle id="roads" label="Roads" checked={layers.roads} onChange={(v) => setLayers((l) => ({ ...l, roads: v }))} />
      <LayerToggle id="pois" label="POIs" checked={layers.pois} onChange={(v) => setLayers((l) => ({ ...l, pois: v }))} />
      <LayerToggle id="contours" label="Contours" checked={layers.contours} onChange={(v) => setLayers((l) => ({ ...l, contours: v }))} />
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
              <MapPinned className="h-3.5 w-3.5 text-green-400 shrink-0" />
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
                  <Layers className="h-4 w-4 text-green-400 shrink-0" />
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
          <Button
            type="button"
            size="sm"
            variant={placeMode ? "default" : "outline"}
            className="h-11 sm:h-9 w-full sm:w-auto text-[11px] tracking-wider touch-manipulation shrink-0"
            onClick={() => {
              setPlaceMode((p) => !p);
              if (placeMode) setPending(null);
            }}
          >
            {placeMode ? "TAP MAP TO PLACE" : "PLACE MARKER"}
          </Button>
        </div>
        <p className="text-[9px] text-muted-foreground leading-snug">
          Active: <span className="text-foreground font-mono">{currentLabel}</span>
          {" · "}
          NATO APP-6 symbols · game X/Z (m). Others see updates instantly via WebSocket.
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
          <CollapsibleContent className="px-3 pb-3 pt-0 border-t border-border/60">
            {layerToggles}
          </CollapsibleContent>
        </Collapsible>

        <div className="flex flex-col lg:flex-row gap-3 flex-1 min-h-0 pb-2 md:pb-0">
          <div
            className={`flex-1 rounded border border-border overflow-hidden relative z-0 ${
              mobileShell ? "min-h-[min(58dvh,560px)]" : "min-h-[420px] lg:min-h-[min(70dvh,720px)]"
            }`}
          >
          {mapKey ? (
            <MapContainer
              key={mapKey}
              crs={L.CRS.Simple}
              bounds={bounds}
              minZoom={-2}
              maxZoom={2}
              maxBounds={bounds}
              maxBoundsViscosity={1}
              className="h-full w-full min-h-[inherit] [&.leaflet-container]:bg-[hsl(150_15%_10%)] [&.leaflet-container]:outline-none"
              style={{ minHeight: mobileShell ? "min(58dvh,560px)" : 420 }}
              zoomControl
            >
              <MapClickHandler enabled={placeMode} onClick={onMapClick} />
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
                  data={geo.structures}
                  coordsToLatLng={gameCoordsToLatLng}
                  style={() => ({
                    color: "rgba(148,163,184,0.5)",
                    weight: 0.5,
                    fillOpacity: 0.08,
                  })}
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
              {markers.map((m) => (
                <Marker
                  key={m.id}
                  position={[m.gameZ, m.gameX]}
                  icon={makeNatoDivIcon(m.sidc)}
                />
              ))}
            </MapContainer>
          ) : null}
        </div>

        <div
          className={`w-full lg:w-[280px] shrink-0 flex flex-col gap-2 border border-border rounded-md bg-card/40 p-2 overflow-hidden ${
            mobileShell ? "max-h-[36dvh] min-h-[140px]" : "max-h-[50vh] lg:max-h-none"
          }`}
        >
          <div className="text-[10px] font-bold tracking-widest text-muted-foreground px-0.5">
            MARKERS · {currentLabel}
          </div>
          <div className="text-[9px] text-muted-foreground px-0.5">
            {markersLoading ? "Loading…" : `${markers.length} on this map only`}
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain space-y-1.5 pr-1 -mr-1 touch-pan-y">
            {markers.map((m) => {
              const canDel = canDeleteMarker(m, user?.username, user?.role);
              return (
                <div
                  key={m.id}
                  className="flex items-start gap-2 text-[10px] border border-border/60 rounded p-2 bg-background/50"
                >
                  <div
                    className="shrink-0 w-9 h-9 flex items-center justify-center overflow-hidden"
                    dangerouslySetInnerHTML={{
                      __html: new ms.Symbol(m.sidc, { size: 24, fill: true }).asSVG(),
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-green-400/90 truncate">{m.label || m.markerType}</div>
                    <div className="text-muted-foreground text-[9px]">
                      {m.affiliation} · {m.createdBy}
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
      </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm tracking-wider">ADD NATO MARKER</DialogTitle>
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
                <SelectContent>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="hostile">Hostile</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">TYPE</Label>
              <Select
                value={form.markerType}
                onValueChange={(v) => setForm((f) => ({ ...f, markerType: v as TacMarkerCategory }))}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unit">Unit</SelectItem>
                  <SelectItem value="vehicle">Vehicle</SelectItem>
                  <SelectItem value="building">Building / Installation</SelectItem>
                  <SelectItem value="equipment">Equipment / Supply</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">LABEL (OPTIONAL)</Label>
              <Input
                className="h-9 text-xs font-mono"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. 1-A / OBJ BLUE"
              />
            </div>
            <div className="flex items-center gap-2 border border-border rounded p-2 bg-secondary/30">
              <div
                className="w-12 h-12 shrink-0 flex items-center justify-center"
                dangerouslySetInnerHTML={{
                  __html: new ms.Symbol(previewSidc, { size: 36, fill: true }).asSVG(),
                }}
                />
              <div className="text-[9px] text-muted-foreground leading-snug">
                Symbol follows STANAG APP-6 / MIL-STD-2525 letter SIDC (milsymbol). Server assigns SIDC from affiliation + type.
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
