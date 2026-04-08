import { useCallback, useEffect, useMemo, useRef } from "react";
import { Network } from "vis-network";
import type { Data, Edge, Node, Options } from "vis-network";
import type { EntityLink, IntelReport, Threat } from "@shared/schema";
import { cn } from "@/lib/utils";
import "vis-network/styles/vis-network.css";

/** Stable node id for vis-network */
export function entityNodeKey(type: string, id: string): string {
  return `${type}:${id}`;
}

export type EntityLabelMaps = {
  users: Map<string, string>;
  units: Map<string, string>;
  location: Map<string, string>;
  threats: Map<string, string>;
  intel: Map<string, string>;
  isofac: Map<string, string>;
  operations: Map<string, string>;
  casualties: Map<string, string>;
};

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}

function resolveLabel(type: string, id: string, maps: EntityLabelMaps): string {
  const m =
    maps[type as keyof EntityLabelMaps] ??
    (() => {
      const empty = new Map<string, string>();
      return empty;
    })();
  const direct = m.get(id);
  if (direct) return direct;
  return `${type} ${id}`;
}

export function buildEntityGraph(
  links: EntityLink[],
  maps: EntityLabelMaps,
  opts: {
    threats?: Threat[];
    intel?: IntelReport[];
    includeDerivedGridEdges?: boolean;
  },
): { nodes: Node[]; edges: Edge[] } {
  const { threats = [], intel = [], includeDerivedGridEdges = true } = opts;
  const nodeMap = new Map<string, Node>();

  const ensureNode = (type: string, id: string) => {
    const key = entityNodeKey(type, id);
    if (nodeMap.has(key)) return;
    const full = resolveLabel(type, id, maps);
    nodeMap.set(key, {
      id: key,
      label: truncate(full, 32),
      title: `${type}:${id}\n${full}`,
      group: type,
    });
  };

  const edges: Edge[] = [];

  for (const l of links) {
    ensureNode(l.aType, l.aId);
    ensureNode(l.bType, l.bId);
    edges.push({
      id: `link-${l.id}`,
      from: entityNodeKey(l.aType, l.aId),
      to: entityNodeKey(l.bType, l.bId),
      label: l.relation,
      arrows: "to",
      font: { align: "middle", size: 9, color: "#94a3b8" },
    });
  }

  if (includeDerivedGridEdges) {
    const norm = (g: string) => g.trim().replace(/\s+/g, " ");
    for (const t of threats) {
      const g = norm(t.grid || "");
      if (!g) continue;
      ensureNode("threats", String(t.id));
      ensureNode("location", g);
      edges.push({
        id: `derived-t-${t.id}-loc`,
        from: entityNodeKey("threats", String(t.id)),
        to: entityNodeKey("location", g),
        label: "grid",
        dashes: [6, 6],
        color: { color: "#64748b" },
        arrows: "to",
        font: { size: 8, color: "#64748b" },
      });
    }
    for (const r of intel) {
      const g = norm(r.grid || "");
      if (!g) continue;
      ensureNode("intel", String(r.id));
      ensureNode("location", g);
      edges.push({
        id: `derived-i-${r.id}-loc`,
        from: entityNodeKey("intel", String(r.id)),
        to: entityNodeKey("location", g),
        label: "grid",
        dashes: [6, 6],
        color: { color: "#64748b" },
        arrows: "to",
        font: { size: 8, color: "#64748b" },
      });
    }
  }

  return { nodes: Array.from(nodeMap.values()), edges };
}

const GROUP_STYLES: Record<
  string,
  { background: string; border: string; highlight: { background: string; border: string } }
> = {
  users: { background: "#1e3a8a", border: "#3b82f6", highlight: { background: "#2563eb", border: "#60a5fa" } },
  units: { background: "#14532d", border: "#22c55e", highlight: { background: "#166534", border: "#4ade80" } },
  location: { background: "#9a3412", border: "#fb923c", highlight: { background: "#c2410c", border: "#fdba74" } },
  threats: { background: "#7f1d1d", border: "#ef4444", highlight: { background: "#991b1b", border: "#f87171" } },
  intel: { background: "#4c1d95", border: "#a78bfa", highlight: { background: "#5b21b6", border: "#c4b5fd" } },
  operations: { background: "#0e7490", border: "#22d3ee", highlight: { background: "#155e75", border: "#67e8f9" } },
  isofac: { background: "#374151", border: "#9ca3af", highlight: { background: "#4b5563", border: "#d1d5db" } },
  casualties: { background: "#831843", border: "#f472b6", highlight: { background: "#9d174d", border: "#f9a8d4" } },
};

function buildGroups(): NonNullable<Options["groups"]> {
  const out: Record<string, { color: { background: string; border: string; highlight: { background: string; border: string } } }> = {};
  for (const [g, c] of Object.entries(GROUP_STYLES)) {
    out[g] = { color: { background: c.background, border: c.border, highlight: c.highlight } };
  }
  return out;
}

type EntityLinkGraphProps = {
  links: EntityLink[];
  maps: EntityLabelMaps;
  threats?: Threat[];
  intel?: IntelReport[];
  includeDerivedGridEdges?: boolean;
  focusNodeId?: string | null;
  className?: string;
  onNodeSelect?: (nodeId: string | null) => void;
};

export function EntityLinkGraph({
  links,
  maps,
  threats = [],
  intel = [],
  includeDerivedGridEdges = true,
  focusNodeId,
  className,
  onNodeSelect,
}: EntityLinkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);

  const { nodes, edges } = useMemo(
    () => buildEntityGraph(links, maps, { threats, intel, includeDerivedGridEdges }),
    [links, maps, threats, intel, includeDerivedGridEdges],
  );

  const graphData = useMemo((): Data => ({ nodes, edges }), [nodes, edges]);

  const onSelectRef = useRef(onNodeSelect);
  onSelectRef.current = onNodeSelect;

  const setup = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    networkRef.current?.destroy();
    networkRef.current = null;
    if (nodes.length === 0 && edges.length === 0) return;

    const net = new Network(
      el,
      graphData,
      {
        autoResize: true,
        physics: {
          enabled: true,
          stabilization: { iterations: 120, updateInterval: 25 },
          barnesHut: { gravitationalConstant: -2500, centralGravity: 0.35, springLength: 140, springConstant: 0.06 },
        },
        interaction: { hover: true, tooltipDelay: 120, navigationButtons: true, keyboard: true, zoomView: true, dragView: true },
        edges: { smooth: { enabled: true, type: "dynamic", roundness: 0.5 } },
        nodes: {
          font: { size: 12, color: "#f1f5f9", face: "JetBrains Mono, ui-monospace, monospace" },
          borderWidth: 2,
          shadow: { enabled: true, color: "rgba(0,0,0,0.45)", size: 8, x: 2, y: 2 },
        },
        groups: buildGroups(),
      },
    );
    networkRef.current = net;
    net.on("click", (p) => {
      const id = p.nodes[0] ? String(p.nodes[0]) : null;
      onSelectRef.current?.(id);
    });
    net.once("stabilizationIterationsDone", () => {
      net.fit({ animation: { duration: 400, easingFunction: "easeInOutQuad" } });
    });
  }, [graphData, nodes.length, edges.length]);

  useEffect(() => {
    setup();
    return () => {
      networkRef.current?.destroy();
      networkRef.current = null;
    };
  }, [setup]);

  useEffect(() => {
    const net = networkRef.current;
    if (!net || !focusNodeId) return;
    try {
      net.selectNodes([focusNodeId]);
      net.focus(focusNodeId, { animation: true, scale: 1.15 });
    } catch {
      /* node missing */
    }
  }, [focusNodeId]);

  const empty = nodes.length === 0;

  return (
    <div className={cn("relative rounded-md border border-border bg-[#050812] overflow-hidden", className)}>
      <div ref={containerRef} className="h-[min(480px,62vh)] w-full min-h-[280px]" />
      {empty && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none px-4 text-center bg-background/75">
          <span className="text-xs text-muted-foreground tracking-wide">No nodes yet.</span>
          <span className="text-[10px] text-muted-foreground/80 max-w-sm">
            Create links between people, units, grids, threats, and intel — or add data with grid coordinates to see dashed &quot;grid&quot; edges.
          </span>
        </div>
      )}
    </div>
  );
}
