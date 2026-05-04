"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Cell } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
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
  isStale?: boolean;
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
  const wonPct = (a.won / TOTAL_SEATS) * 100;
  const leadingPct = (a.leading / TOTAL_SEATS) * 100;
  const majorityPct = (majority / TOTAL_SEATS) * 100;
  const hasMajority = a.total >= majority;

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden flex flex-col">
      <div className="p-4 sm:p-5 flex flex-col gap-3 flex-1">
        {/* name + majority */}
        <div className="flex items-center justify-between gap-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{ALLIANCE_LABELS[a.alliance]}</p>
          {hasMajority && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: color + "30", color }}>
              ✓ Majority
            </span>
          )}
        </div>

        {/* total + won/leading */}
        <div className="flex items-center gap-3">
          <span className="text-5xl sm:text-6xl font-black tracking-tighter leading-none shrink-0" style={{ color }}>{a.total}</span>
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-baseline gap-1">
              <span className="text-base sm:text-lg font-bold leading-none">{a.won}</span>
              <span className="text-[10px] text-muted-foreground">won</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-semibold leading-none text-muted-foreground">{a.leading}</span>
              <span className="text-[10px] text-muted-foreground">leading</span>
            </div>
          </div>
        </div>

        {/* party chips */}
        {parties.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {parties.map((p) => (
              <span key={p} className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                style={{ backgroundColor: color + "15", color }}>
                {p}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* progress bar */}
      <div className="px-4 sm:px-5 pb-4 space-y-1.5">
        <div className="relative h-2 w-full bg-muted/50 rounded-full overflow-hidden">
          <div className="absolute left-0 top-0 h-full rounded-l-full transition-all duration-700"
            style={{ width: `${wonPct}%`, backgroundColor: color }} />
          <div className="leading-shimmer absolute top-0 h-full transition-all duration-700"
            style={{ left: `${wonPct}%`, width: `${leadingPct}%`, backgroundColor: color + "55" }} />
          <div className="absolute top-0 h-full w-[1.5px] bg-foreground/25"
            style={{ left: `${majorityPct}%` }} />
        </div>
        <p className="text-[10px] text-muted-foreground">{majority} seats for majority</p>
      </div>
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
        <div className="flex items-baseline justify-between gap-2">
          <CardTitle className="text-sm font-semibold">Party tally</CardTitle>
          <p className="text-[11px] text-muted-foreground/60">solid = won · faded = leading</p>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ChartContainer config={chartConfig} className="h-72 w-full">
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
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getPartyColor(p.party, i) }} />
                      <div>
                        <div className="font-medium">{p.short}</div>
                        <div className="h-[3px] mt-0.5 rounded-full bg-muted overflow-hidden w-16">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${(p.total / TOTAL_SEATS) * 100}%`, backgroundColor: getPartyColor(p.party, i) + "90" }} />
                        </div>
                      </div>
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

function ConstituencyTable({ constituencies, filter, onFilterChange }: { constituencies: ConstituencyResult[]; filter: string; onFilterChange: (v: string) => void }) {
  const q = filter.toLowerCase();
  const filtered = q
    ? constituencies.filter((c) =>
        c.constituency.toLowerCase().includes(q) ||
        c.leadingCandidate.toLowerCase().includes(q) ||
        c.leadingParty.toLowerCase().includes(q) ||
        shortenParty(c.leadingParty).toLowerCase().includes(q)
      )
    : constituencies;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center justify-between flex-1">
              <CardTitle className="text-sm font-semibold">Constituencies</CardTitle>
              <span className="text-xs text-muted-foreground">{filtered.length} of {constituencies.length}</span>
            </div>
            <Input
              placeholder="Search…"
              value={filter}
              onChange={(e) => onFilterChange(e.target.value)}
              className="h-8 text-xs sm:max-w-xs"
            />
          </div>
          {filter && (
            <p className="text-[11px] text-muted-foreground/60">
              Searching by constituency · leading candidate · party (e.g. DMK, TVK, AIADMK)
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-0">
        <div className="overflow-x-auto max-h-[560px]">
          <table className="w-full text-xs min-w-[540px]">
            <thead className="sticky top-0 bg-card/90 backdrop-blur-sm z-10">
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-2 px-4 font-medium whitespace-nowrap">No.</th>
                <th className="text-left py-2 pr-4 font-medium whitespace-nowrap">Constituency</th>
                <th className="text-left py-2 pr-4 font-medium whitespace-nowrap">Status</th>
                <th className="text-right py-2 pr-4 font-medium whitespace-nowrap">Margin</th>
                <th className="text-center py-2 pr-4 font-medium whitespace-nowrap hidden sm:table-cell">Round</th>
                <th className="text-left py-2 pr-4 font-medium whitespace-nowrap">Leading</th>
                <th className="text-left py-2 pr-4 font-medium whitespace-nowrap">Party</th>
                <th className="text-left py-2 pr-4 font-medium whitespace-nowrap hidden md:table-cell">Trailing</th>
                <th className="text-left py-2 pr-4 font-medium whitespace-nowrap hidden md:table-cell">Party</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-muted-foreground text-xs">
                    No constituencies match “{filter}”
                  </td>
                </tr>
              )}
              {filtered.map((c) => {
                const isDeclared = c.status.toLowerCase().includes("declared");
                const alliance = getAlliance(c.leadingParty);
                const allianceColor = ALLIANCE_COLORS[alliance];
                return (
                  <tr key={`${c.constNo}-${c.constituency}`} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-4 text-muted-foreground tabular-nums">{c.constNo}</td>
                    <td className="py-2.5 pr-4 font-medium whitespace-nowrap">{c.constituency}</td>
                    <td className="py-2.5 pr-4">
                      {isDeclared ? (
                        <span className="inline-flex text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
                          style={{ backgroundColor: allianceColor + "25", color: allianceColor }}>
                          Won
                        </span>
                      ) : (
                        <span className="inline-flex text-[10px] px-1.5 py-0.5 rounded-md font-medium text-muted-foreground bg-muted">
                          Leading
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono font-semibold tabular-nums whitespace-nowrap">
                      {c.margin.toLocaleString("en-IN")}
                    </td>
                    <td className="py-2.5 pr-4 text-center text-muted-foreground whitespace-nowrap hidden sm:table-cell">{c.round}</td>
                    <td className="py-2.5 pr-4 whitespace-nowrap max-w-[140px] truncate">{c.leadingCandidate}</td>
                    <td className="py-2.5 pr-4">
                      <span
                        className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
                        style={{ backgroundColor: allianceColor + "22", color: allianceColor }}
                      >
                        {shortenParty(c.leadingParty)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap max-w-[140px] truncate hidden md:table-cell">{c.trailingCandidate}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap hidden md:table-cell">{shortenParty(c.trailingParty)}</td>
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
  const [justUpdated, setJustUpdated] = useState(false);
  const [bgUpdating, setBgUpdating] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch("/api/results");
      if (!res.ok) return;
      const newData = await res.json();
      setData((prev) => {
        if (prev && prev.fetchedAt !== newData.fetchedAt) {
          setJustUpdated(true);
          setTimeout(() => setJustUpdated(false), 3000);
        }
        return newData;
      });
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
      
      let initialData: ApiResponse | null = null;
      if (res?.ok) {
        initialData = await res.json();
        setData(initialData);
        if (!initialData?.isStale) {
          scheduleNextFetch();
          return;
        }
      }
      
      if (!initialData) {
        setLoadingPage(1);
      } else {
        setBgUpdating(true);
      }
      
      const es = new EventSource("/api/scrape-progress");
      es.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "cached" || msg.type === "done") {
          setData(msg.data);
          if (msg.data?.totalPages) setTotalPages(msg.data.totalPages);
          setLoadingPage(0);
          setBgUpdating(false);
          es.close();
          scheduleNextFetch();
        } else if (msg.type === "progress") {
          setTotalPages(msg.total);
          if (!initialData) setLoadingPage(msg.page);
        } else if (msg.type === "error") {
          setError(msg.message);
          setLoadingPage(0);
          setBgUpdating(false);
          es.close();
          if (initialData) scheduleNextFetch();
        }
      };
      es.onerror = () => { 
        setError("Connection lost. Try refreshing."); 
        setLoadingPage(0); 
        setBgUpdating(false);
        es.close(); 
        if (initialData) scheduleNextFetch();
      };
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
        <div className="max-w-6xl mx-auto px-4 sm:px-5 h-16 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-base font-bold tracking-tight leading-none">TN Elections 2026</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
              </span>
              Live · Election Commission of India
            </p>
          </div>
          <div className="text-xs text-muted-foreground text-right flex items-center gap-2">
            {bgUpdating ? (
              <span className="flex items-center gap-1.5 animate-pulse text-muted-foreground">
                <span className="h-3 w-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                <span className="hidden sm:inline">Updating in background…</span>
              </span>
            ) : justUpdated ? (
              <span className="text-emerald-400 font-semibold animate-pulse">Updated ✓</span>
            ) : (
              <>
                {/* mobile: just the countdown */}
                {!isLoading && nextRefreshAt && (
                  <span className="font-mono tabular-nums sm:hidden text-muted-foreground/60">
                    {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
                  </span>
                )}
                {/* sm+: full updated + countdown */}
                <span className="tabular-nums hidden sm:inline">
                  {data && !isLoading && (
                    <>Updated {new Date(data.fetchedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</>
                  )}
                  {!isLoading && nextRefreshAt && (
                    <span className="text-muted-foreground/50">
                      {data && !isLoading ? " · " : ""}in {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
                    </span>
                  )}
                </span>
              </>
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
        <main className="max-w-6xl mx-auto px-4 sm:px-5 py-6 sm:py-8 space-y-6 sm:space-y-8">

          {/* Alliance scoreboard */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {allianceTally.map((a) => <AllianceCard key={a.alliance} a={a} majority={majority} />)}
          </div>

          {/* Summary strip — 2×2 on mobile, 4-col on sm+ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
            {[
              { label: "Total Seats", value: data.constituencies.length },
              { label: "Majority Mark", value: majority },
              { label: "Results Declared", value: declared },
              { label: "Counting", value: leading },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium">{label}</p>
                <p className="text-3xl font-black tabular-nums leading-tight mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PartyChart tally={tally} />
            <PartyTable tally={tally} />
          </div>

          {/* Constituency table — filter is inside the card header */}
          <ConstituencyTable constituencies={data.constituencies} filter={filter} onFilterChange={setFilter} />

          {/* Legend */}
          <AbbreviationLegend tally={tally} />
        </main>
      )}
    </div>
  );
}
