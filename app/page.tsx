"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Cell } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
  DMK: "#FF0000",
  AIADMK: "#10B981",
  TVK: "#8B0000",
  BJP: "#F97D09",
  INC: "#138808",
  VCK: "#0099FF",
  CPI: "#CC0000",
  CPM: "#E53E3E",
  PMK: "#2563EB",
  IUML: "#006600",
  MDMK: "#B91C1C",
  NTK: "#DC2626",
  MNM: "#7C3AED",
  IND: "#6b7280",
};

const STOP_AT = new Date("2026-05-05T00:00:00+05:30").getTime();
const TOTAL_SEATS = 234;

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
  const fallbacks = ["#6366f1", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b", "#10b981", "#3b82f6", "#ef4444"];
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
  return (["DMK", "AIADMK", "TVK", "OTHER"] as const)
    .map((a) => map.get(a) ?? { alliance: a, won: 0, leading: 0, total: 0 })
    .filter((a) => a.total > 0);
}

function msUntilNextSlot(): number {
  const slotMs = 2 * 60 * 1000;
  return slotMs - (Date.now() % slotMs);
}

// ─── Components ───────────────────────────────────────────────────────────────

function ProgressLoader({ page, total }: { page: number; total: number }) {
  const pct = total > 0 ? Math.round((page / total) * 100) : 0;
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-10">
      <div className="text-center space-y-2">
        <p className="text-base font-semibold">Fetching live results</p>
        <p className="text-sm text-muted-foreground">
          {total > 0 ? `Page ${page} of ${total}` : "Connecting…"} · Election Commission of India
        </p>
      </div>
      <div className="w-80 space-y-4">
        <div className="h-[2px] w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-foreground rounded-full transition-all duration-500 ease-out"
            style={{ width: total > 0 ? `${pct}%` : "10%" }}
          />
        </div>
        {total > 0 && (
          <div className="flex gap-1">
            {Array.from({ length: total }, (_, i) => (
              <div
                key={i}
                className={`flex-1 h-[3px] rounded-full transition-colors duration-300 ${i < page ? "bg-foreground" : "bg-muted"}`}
              />
            ))}
          </div>
        )}
        <p className="text-center text-xs text-muted-foreground">{pct}%</p>
      </div>
    </div>
  );
}

function AllianceCard({ a, majority }: { a: AllianceTally; majority: number }) {
  const color = ALLIANCE_COLORS[a.alliance];
  const parties = ALLIANCE_PARTIES[a.alliance];
  const pct = Math.round((a.total / TOTAL_SEATS) * 100);

  return (
    <div className="relative rounded-2xl border border-border/60 bg-card overflow-hidden p-6 flex flex-col gap-4">
      {/* color bar top */}
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: color }} />

      {/* header */}
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="text-sm font-semibold">{ALLIANCE_LABELS[a.alliance]}</span>
          {a.total >= majority && (
            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: color + "22", color }}>
              MAJORITY
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground pl-4">{ALLIANCE_SUBLABELS[a.alliance]}</p>
      </div>

      {/* big number */}
      <div>
        <span className="text-6xl font-black tracking-tighter leading-none" style={{ color }}>{a.total}</span>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[11px] font-semibold text-foreground">{a.won} won</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-[11px] text-muted-foreground">{a.leading} leading</span>
        </div>
      </div>

      {/* seat bar */}
      <div className="space-y-1.5">
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{pct}% of seats</span>
          <span>{majority} for majority</span>
        </div>
      </div>

      {/* party chips */}
      {parties.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-2 border-t border-border/40">
          {parties.map((p) => (
            <span
              key={p}
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: color + "18", color }}
            >
              {p}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function PartyChart({ tally }: { tally: PartyTally[] }) {
  const chartConfig = Object.fromEntries(
    tally.map((p, i) => [p.short, { label: p.short, color: getPartyColor(p.party, i) }])
  );
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Party tally</CardTitle>
        <p className="text-xs text-muted-foreground">Solid = won · faded = leading</p>
      </CardHeader>
      <CardContent className="pt-0">
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <BarChart data={tally} margin={{ top: 4, right: 4, left: -20, bottom: 52 }}>
            <XAxis dataKey="short" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
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
    <Card className="border-border/60">
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
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getPartyColor(p.party, i) }} />
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
    <Card className="border-border/60">
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
                        className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
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
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Party abbreviations</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-2">
          {tally.map((p, i) => (
            <div key={p.party} className="flex items-center gap-2 text-xs">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getPartyColor(p.party, i) }} />
              <span className="font-semibold w-14 shrink-0">{p.short}</span>
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
  const [checking, setChecking] = useState(true);
  const [loadingPage, setLoadingPage] = useState(0);
  const [totalPages, setTotalPages] = useState(12);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [nextRefreshAt, setNextRefreshAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(0);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch("/api/results");
      if (!res.ok) return;
      setData(await res.json());
      setError(null);
    } catch { /* keep existing data */ }
  }, []);

  const scheduleNextFetch = useCallback(() => {
    if (Date.now() >= STOP_AT) { setNextRefreshAt(null); return; }
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const ms = msUntilNextSlot();
    setNextRefreshAt(new Date(Date.now() + ms));
    setCountdown(Math.floor(ms / 1000));
    refreshTimerRef.current = setTimeout(() => { fetchResults(); scheduleNextFetch(); }, ms);
  }, [fetchResults]);

  useEffect(() => {
    async function initialLoad() {
      const res = await fetch("/api/results").catch(() => null);
      setChecking(false);
      if (res?.ok) {
        setData(await res.json());
        scheduleNextFetch();
        return;
      }
      setLoadingPage(1);
      const es = new EventSource("/api/scrape-progress");
      es.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "cached" || msg.type === "done") {
          setData(msg.data);
          if (msg.data?.totalPages) setTotalPages(msg.data.totalPages);
          setLoadingPage(0);
          es.close();
          scheduleNextFetch();
        } else if (msg.type === "progress") {
          setTotalPages(msg.total);
          setLoadingPage(msg.page);
        } else if (msg.type === "error") {
          setError(msg.message);
          setLoadingPage(0);
          es.close();
        }
      };
      es.onerror = () => { setError("Connection lost. Try refreshing."); setLoadingPage(0); es.close(); };
    }
    initialLoad();
    return () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); };
  }, [scheduleNextFetch]);

  useEffect(() => {
    const t = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  const tally = data ? tallyByParty(data.constituencies) : [];
  const allianceTally = data ? tallyByAlliance(data.constituencies) : [];
  const declared = tally.reduce((s, p) => s + p.won, 0);
  const leading = tally.reduce((s, p) => s + p.leading, 0);
  const majority = Math.floor(TOTAL_SEATS / 2) + 1;
  const isLoading = !checking && loadingPage > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-sm font-bold tracking-tight leading-none">TN Elections 2026</h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">Live · Election Commission of India</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {data && !isLoading && (
              <span className="hidden sm:block">Updated {new Date(data.fetchedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
            )}
            {!isLoading && nextRefreshAt && (
              <span className="font-mono tabular-nums" title={`Next at ${nextRefreshAt.toLocaleTimeString("en-IN")}`}>
                {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
              </span>
            )}
          </div>
        </div>
      </header>

      {isLoading && <ProgressLoader page={loadingPage} total={totalPages} />}

      {error && (
        <div className="max-w-6xl mx-auto px-5 pt-6">
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
        </div>
      )}

      {!isLoading && data && (
        <main className="max-w-6xl mx-auto px-5 py-8 space-y-8">

          {/* Alliance scoreboard */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {allianceTally.map((a) => <AllianceCard key={a.alliance} a={a} majority={majority} />)}
          </div>

          {/* Summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total seats", value: data.constituencies.length },
              { label: "Majority mark", value: majority },
              { label: "Results declared", value: declared },
              { label: "Counting in progress", value: leading },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-border/60 bg-card px-4 py-3">
                <p className="text-[11px] text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold tabular-nums mt-0.5">{value}</p>
              </div>
            ))}
          </div>

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
              className="max-w-sm h-8 text-xs"
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
