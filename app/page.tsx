"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Cell } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConstituencyResult {
  constituency: string;
  constNo: number;
  leadingCandidate: string;
  leadingParty: string;
  trailingCandidate: string;
  trailingParty: string;
  margin: number;
  round: string;
  status: string;
}

interface ApiResponse {
  constituencies: ConstituencyResult[];
  fetchedAt: string;
  totalPages: number;
}

interface PartyTally {
  party: string;
  short: string;
  won: number;
  leading: number;
  total: number;
}

interface AllianceTally {
  alliance: "DMK" | "AIADMK" | "TVK" | "OTHER";
  won: number;
  leading: number;
  total: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PARTY_ABBR: Record<string, string> = {
  "Dravida Munnetra Kazhagam": "DMK",
  "All India Anna Dravida Munnetra Kazhagam": "AIADMK",
  "Tamilaga Vettri Kazhagam": "TVK",
  "Bharatiya Janata Party": "BJP",
  "Indian National Congress": "INC",
  "Viduthalai Chiruthaigal Katchi": "VCK",
  "Communist Party of India": "CPI",
  "Communist Party of India  (Marxist)": "CPM",
  "Communist Party of India (Marxist)": "CPM",
  "Pattali Makkal Katchi": "PMK",
  "Indian Union Muslim League": "IUML",
  "Marumalarchi Dravida Munnetra Kazhagam": "MDMK",
  "Nam Tamilar Katchi": "NTK",
  "Makkal Needhi Maiam": "MNM",
  "All India Forward Bloc": "AIFB",
  "Kongunadu Makkal Desia Katchi": "KMDK",
  "Kongunadu Makkal Desiya Katchi": "KMDK",
  "Tamil Maanila Congress": "TMC",
  "Tamil Maanila Congress (Moopanar)": "TMC(M)",
  "Manithaneya Makkal Katchi": "MMK",
  "Independent": "IND",
};

const ALLIANCE_MAP: Record<string, "DMK" | "AIADMK" | "TVK" | "OTHER"> = {
  "Dravida Munnetra Kazhagam": "DMK",
  "Indian National Congress": "DMK",
  "Viduthalai Chiruthaigal Katchi": "DMK",
  "Communist Party of India": "DMK",
  "Communist Party of India  (Marxist)": "DMK",
  "Communist Party of India (Marxist)": "DMK",
  "Indian Union Muslim League": "DMK",
  "Marumalarchi Dravida Munnetra Kazhagam": "DMK",
  "Manithaneya Makkal Katchi": "DMK",
  "MMK": "DMK",
  "Kongunadu Makkal Desia Katchi": "DMK",
  "Kongunadu Makkal Desiya Katchi": "DMK",
  "All India Forward Bloc": "DMK",
  "Adi Tamilar Peravai": "DMK",
  "Tamizhar Desam Katchi": "DMK",
  "Manithaneya Jananayaka Katchi": "DMK",
  "All India Anna Dravida Munnetra Kazhagam": "AIADMK",
  "Bharatiya Janata Party": "AIADMK",
  "Pattali Makkal Katchi": "AIADMK",
  "All India Makkal Munnetra Kazhagam": "AIADMK",
  "Tamil Maanila Congress (Moopanar)": "AIADMK",
  "Tamil Maanila Congress": "AIADMK",
  "TMC(M)": "AIADMK",
  "Indhiya Jananayaga Katchi": "AIADMK",
  "IJK": "AIADMK",
  "Puthiya Needhi Katchi": "AIADMK",
  "Puratchi Bharatham": "AIADMK",
  "South Indian Forward Bloc": "AIADMK",
  "Pasumpon Desiya Kazhagam": "AIADMK",
  "Uzhavar Uzhaippalar Katchi": "AIADMK",
  "Singa Tamilar Munnetra Kazhagam": "AIADMK",
  "All India Moovendar Munnetra Kazhagam": "AIADMK",
  "Tamilaga Vettri Kazhagam": "TVK",
};

const ALLIANCE_COLORS = { DMK: "#E63946", AIADMK: "#2DC653", TVK: "#06D6A0", OTHER: "#6b7280" };
const ALLIANCE_LABELS = { DMK: "DMK Alliance", AIADMK: "AIADMK Alliance", TVK: "TVK", OTHER: "Others" };
const ALLIANCE_SUBLABELS = { DMK: "Secular Progressive Alliance", AIADMK: "NDA Tamil Nadu", TVK: "Contesting independently", OTHER: "" };

const ALLIANCE_PARTIES: Record<"DMK" | "AIADMK" | "TVK" | "OTHER", string[]> = {
  DMK: ["DMK", "INC", "VCK", "CPI", "CPM", "IUML", "MDMK", "MMK", "KMDK", "AIFB"],
  AIADMK: ["AIADMK", "BJP", "PMK", "TMC(M)", "IJK"],
  TVK: ["TVK"],
  OTHER: [],
};

const PARTY_COLORS: Record<string, string> = {
  DMK: "#FF0000",     // Red (flag primary)
  AIADMK: "#10B981",  // Green (distinct from DMK red; party uses black+red but green is used on dashboards)
  TVK: "#8B0000",     // Dark maroon (flag top/bottom band)
  BJP: "#F97D09",     // Saffron/orange (flag primary)
  INC: "#138808",     // Congress green (wheel)
  VCK: "#0099FF",     // Sky blue (flag primary)
  CPI: "#CC0000",     // Communist red (slightly darker)
  CPM: "#E53E3E",     // Communist red (slightly different shade)
  PMK: "#2563EB",     // Blue (flag top band)
  IUML: "#006600",    // Dark green (flag primary)
  MDMK: "#B91C1C",    // Deep red (flag)
  NTK: "#DC2626",     // Red (flag)
  MNM: "#7C3AED",     // Purple (torch symbol)
  IND: "#6b7280",     // Gray
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortenParty(name: string): string {
  if (!name) return "";
  if (PARTY_ABBR[name]) return PARTY_ABBR[name];
  if (name.length > 20) {
    const abbr = name.split(/\s+/).filter((w) => w.length > 2).map((w) => w[0].toUpperCase()).join("");
    return abbr || name;
  }
  return name;
}

function getAlliance(name: string): "DMK" | "AIADMK" | "TVK" | "OTHER" {
  return ALLIANCE_MAP[name] ?? "OTHER";
}

function getPartyColor(party: string, index: number): string {
  const upper = party.toUpperCase();
  const key = Object.keys(PARTY_COLORS).find((k) => upper.includes(k));
  if (key) return PARTY_COLORS[key];
  const fallbacks = ["#6366f1","#8b5cf6","#ec4899","#14b8a6","#f59e0b","#10b981","#3b82f6","#ef4444"];
  return fallbacks[index % fallbacks.length];
}

function tallyByParty(constituencies: ConstituencyResult[]): PartyTally[] {
  const map = new Map<string, PartyTally>();
  for (const c of constituencies) {
    const party = c.leadingParty || "Unknown";
    const isWon = c.status.toLowerCase().includes("declared");
    const ex = map.get(party);
    if (ex) { if (isWon) ex.won++; else ex.leading++; ex.total++; }
    else map.set(party, { party, short: shortenParty(party), won: isWon ? 1 : 0, leading: isWon ? 0 : 1, total: 1 });
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function tallyByAlliance(constituencies: ConstituencyResult[]): AllianceTally[] {
  const map = new Map<string, AllianceTally>();
  for (const c of constituencies) {
    const a = getAlliance(c.leadingParty);
    const isWon = c.status.toLowerCase().includes("declared");
    const ex = map.get(a);
    if (ex) { if (isWon) ex.won++; else ex.leading++; ex.total++; }
    else map.set(a, { alliance: a, won: isWon ? 1 : 0, leading: isWon ? 0 : 1, total: 1 });
  }
  return (["DMK","AIADMK","TVK","OTHER"] as const)
    .map((a) => map.get(a) ?? { alliance: a, won: 0, leading: 0, total: 0 })
    .filter((a) => a.total > 0);
}

/** ms until the next wall-clock 5-min boundary (10:00, 10:05, 10:10, …) */
function msUntilNextSlot(): number {
  const now = new Date();
  const ms = now.getTime();
  const slotMs = 5 * 60 * 1000;
  return slotMs - (ms % slotMs);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressLoader({ page, total }: { page: number; total: number }) {
  const pct = total > 0 ? Math.round((page / total) * 100) : 0;
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-foreground">Fetching live results</p>
        <p className="text-xs text-muted-foreground">
          Page {page} of {total || "?"} · Election Commission of India
        </p>
      </div>
      <div className="w-72 space-y-3">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-foreground rounded-full transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        {total > 0 && (
          <div className="flex gap-1 justify-between">
            {Array.from({ length: total }, (_, i) => (
              <div key={i} className={`flex-1 h-0.5 rounded-full transition-colors duration-300 ${i < page ? "bg-foreground" : "bg-muted"}`} />
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">First load takes ~60s · auto-refreshes every 5 min</p>
    </div>
  );
}

function AllianceCard({ a }: { a: AllianceTally }) {
  const color = ALLIANCE_COLORS[a.alliance];
  const parties = ALLIANCE_PARTIES[a.alliance];
  return (
    <Card className="relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm">
      <div className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: color }} />
      <CardHeader className="pb-2 pt-5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <CardTitle className="text-sm font-semibold">{ALLIANCE_LABELS[a.alliance]}</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground pl-4">{ALLIANCE_SUBLABELS[a.alliance]}</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-baseline gap-1">
          <span className="text-5xl font-bold tracking-tight" style={{ color }}>{a.won}</span>
          <span className="text-lg text-muted-foreground font-medium">+{a.leading}</span>
        </div>
        <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
          <span><span className="font-medium text-foreground">{a.won}</span> won</span>
          <span><span className="font-medium text-foreground">{a.leading}</span> leading</span>
          <span className="ml-auto"><span className="font-medium text-foreground">{a.total}</span> total</span>
        </div>
        {parties.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-border/40">
            {parties.map((p) => (
              <span
                key={p}
                className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold"
                style={{ backgroundColor: color + "18", color }}
              >
                {p}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PartyChart({ tally }: { tally: PartyTally[] }) {
  const chartConfig = Object.fromEntries(
    tally.map((p, i) => [p.short, { label: p.short, color: getPartyColor(p.party, i) }])
  );

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Party tally</CardTitle>
        <p className="text-xs text-muted-foreground">Solid = won · faded = leading</p>
      </CardHeader>
      <CardContent className="pt-0">
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <BarChart data={tally} margin={{ top: 4, right: 4, left: -20, bottom: 52 }}>
            <XAxis
              dataKey="short"
              tick={{ fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              interval={0}
              axisLine={false}
              tickLine={false}
            />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
            <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
            <Bar dataKey="won" name="Won" stackId="a" radius={[0, 0, 0, 0]}>
              {tally.map((e, i) => <Cell key={e.party} fill={getPartyColor(e.party, i)} />)}
            </Bar>
            <Bar dataKey="leading" name="Leading" stackId="a" radius={[3, 3, 0, 0]}>
              {tally.map((e, i) => <Cell key={e.party} fill={getPartyColor(e.party, i)} opacity={0.35} />)}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function PartyTable({ tally }: { tally: PartyTally[] }) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Party breakdown</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-auto max-h-64">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left pb-2 pr-3 font-medium">#</th>
                <th className="text-left pb-2 pr-3 font-medium">Party</th>
                <th className="text-right pb-2 pr-3 font-medium">Won</th>
                <th className="text-right pb-2 pr-3 font-medium">Leading</th>
                <th className="text-right pb-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {tally.map((p, i) => (
                <tr key={p.party} className="hover:bg-muted/30 transition-colors">
                  <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: getPartyColor(p.party, i) }} />
                      <span className="font-medium">{p.short}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-right font-semibold">{p.won}</td>
                  <td className="py-2 pr-3 text-right text-muted-foreground">{p.leading}</td>
                  <td className="py-2 text-right font-bold">{p.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ConstituencyTable({ constituencies, filter }: { constituencies: ConstituencyResult[]; filter: string }) {
  const filtered = filter
    ? constituencies.filter((c) =>
        c.leadingParty.toLowerCase().includes(filter.toLowerCase()) ||
        c.constituency.toLowerCase().includes(filter.toLowerCase()) ||
        c.leadingCandidate.toLowerCase().includes(filter.toLowerCase())
      )
    : constituencies;

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Constituencies</CardTitle>
          <span className="text-xs text-muted-foreground">{filtered.length} of {constituencies.length}</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-0">
        <div className="overflow-auto max-h-[560px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-2 px-4 font-medium whitespace-nowrap">No.</th>
                <th className="text-left py-2 pr-4 font-medium whitespace-nowrap">Constituency</th>
                <th className="text-left py-2 pr-4 font-medium whitespace-nowrap">Status</th>
                <th className="text-right py-2 pr-4 font-medium whitespace-nowrap">Margin</th>
                <th className="text-center py-2 pr-4 font-medium whitespace-nowrap">Round</th>
                <th className="text-left py-2 pr-4 font-medium whitespace-nowrap">Leading</th>
                <th className="text-left py-2 pr-4 font-medium whitespace-nowrap">Party</th>
                <th className="text-left py-2 pr-4 font-medium whitespace-nowrap">Trailing</th>
                <th className="text-left py-2 pr-4 font-medium whitespace-nowrap">Party</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filtered.map((c) => {
                const isDeclared = c.status.toLowerCase().includes("declared");
                const allianceColor = ALLIANCE_COLORS[getAlliance(c.leadingParty)];
                return (
                  <tr key={`${c.constNo}-${c.constituency}`} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-4 text-muted-foreground tabular-nums">{c.constNo}</td>
                    <td className="py-2.5 pr-4 font-medium whitespace-nowrap">{c.constituency}</td>
                    <td className="py-2.5 pr-4">
                      <Badge variant={isDeclared ? "default" : "secondary"} className="text-[10px] px-1.5 py-0 font-medium">
                        {isDeclared ? "Won" : "Leading"}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono font-semibold tabular-nums whitespace-nowrap">
                      {c.margin.toLocaleString("en-IN")}
                    </td>
                    <td className="py-2.5 pr-4 text-center text-muted-foreground whitespace-nowrap">{c.round}</td>
                    <td className="py-2.5 pr-4 whitespace-nowrap">{c.leadingCandidate}</td>
                    <td className="py-2.5 pr-4">
                      <span
                        className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap"
                        style={{ backgroundColor: allianceColor + "22", color: allianceColor }}
                      >
                        {shortenParty(c.leadingParty)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">{c.trailingCandidate}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">{shortenParty(c.trailingParty)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function AbbreviationLegend({ tally }: { tally: PartyTally[] }) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Party abbreviations</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-1.5">
          {tally.map((p, i) => (
            <div key={p.party} className="flex items-center gap-2 text-xs">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: getPartyColor(p.party, i) }} />
              <span className="font-semibold text-foreground flex-shrink-0 w-14">{p.short}</span>
              <span className="text-muted-foreground truncate">{p.party}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loadingPage, setLoadingPage] = useState(0);
  const [totalPages, setTotalPages] = useState(12);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [nextRefreshAt, setNextRefreshAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(0);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Fetch from /api/results (instant — just reads server cache) */
  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch("/api/results");
      if (!res.ok) return; // 503 means cache cold — initial SSE load still running
      const json: ApiResponse = await res.json();
      setData(json);
      setError(null);
    } catch {
      // network blip — keep showing existing data
    }
  }, []);

  /** Schedule next fetch at the next wall-clock 5-min boundary */
  const scheduleNextFetch = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const ms = msUntilNextSlot();
    const at = new Date(Date.now() + ms);
    setNextRefreshAt(at);
    setCountdown(Math.floor(ms / 1000));
    refreshTimerRef.current = setTimeout(() => {
      fetchResults();
      scheduleNextFetch(); // reschedule for the slot after that
    }, ms);
  }, [fetchResults]);

  /** Initial load: try /api/results first; if cold, fall back to SSE progress stream */
  useEffect(() => {
    async function initialLoad() {
      const res = await fetch("/api/results").catch(() => null);
      if (res?.ok) {
        const json: ApiResponse = await res.json();
        setData(json);
        scheduleNextFetch();
        return;
      }

      // Cache is cold (first deploy) — stream scrape progress
      setLoadingPage(1);
      const es = new EventSource("/api/scrape-progress");
      es.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "cached") {
          setData(msg.data);
          setLoadingPage(0);
          es.close();
          scheduleNextFetch();
        } else if (msg.type === "start") {
          setLoadingPage(1);
        } else if (msg.type === "progress") {
          setTotalPages(msg.total);
          setLoadingPage(msg.page);
        } else if (msg.type === "done") {
          setData(msg.data);
          setTotalPages(msg.data.totalPages);
          setLoadingPage(0);
          es.close();
          scheduleNextFetch();
        } else if (msg.type === "error") {
          setError(msg.message);
          setLoadingPage(0);
          es.close();
        }
      };
      es.onerror = () => {
        setError("Connection lost. Try refreshing.");
        setLoadingPage(0);
        es.close();
      };
    }

    initialLoad();
    return () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); };
  }, [scheduleNextFetch]);

  /** Countdown ticker */
  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const tally = data ? tallyByParty(data.constituencies) : [];
  const allianceTally = data ? tallyByAlliance(data.constituencies) : [];
  const won = tally.reduce((s, p) => s + p.won, 0);
  const leading = tally.reduce((s, p) => s + p.leading, 0);
  const isLoading = loadingPage > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-sm font-semibold tracking-tight">Tamil Nadu Elections 2026</h1>
            <p className="text-[11px] text-muted-foreground">Election Commission of India · Live</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {data && !isLoading && (
              <span>Updated {new Date(data.fetchedAt).toLocaleTimeString("en-IN")}</span>
            )}
            {!isLoading && nextRefreshAt && (
              <span className="font-mono tabular-nums" title={`Next refresh at ${nextRefreshAt.toLocaleTimeString("en-IN")}`}>
                {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={fetchResults}
              disabled={isLoading}
              className="h-7 text-xs"
            >
              {isLoading ? "Scraping…" : "Refresh"}
            </Button>
          </div>
        </div>
      </header>

      {isLoading && <ProgressLoader page={loadingPage} total={totalPages} />}

      {error && (
        <div className="max-w-7xl mx-auto px-6 pt-6">
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        </div>
      )}

      {!isLoading && data && (
        <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

          {/* Alliance scoreboard */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {allianceTally.map((a) => <AllianceCard key={a.alliance} a={a} />)}
          </div>

          <Separator className="opacity-30" />

          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total constituencies", value: data.constituencies.length },
              { label: "Parties in race", value: tally.length },
              { label: "Results declared", value: won },
              { label: "Counting in progress", value: leading },
            ].map(({ label, value }) => (
              <div key={label} className="space-y-1">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold tabular-nums">{value}</p>
              </div>
            ))}
          </div>

          <Separator className="opacity-30" />

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PartyChart tally={tally} />
            <PartyTable tally={tally} />
          </div>

          {/* Constituency table */}
          <div className="space-y-3">
            <Input
              placeholder="Filter by constituency, party or candidate…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="max-w-sm h-8 text-xs bg-card/50 border-border/50"
            />
            <ConstituencyTable constituencies={data.constituencies} filter={filter} />
          </div>

          {/* Legend */}
          <AbbreviationLegend tally={tally} />
        </main>
      )}
    </div>
  );
}
