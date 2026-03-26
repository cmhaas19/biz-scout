"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Profile } from "@/types";

type ConnectStep = "idle" | "waiting" | "paste";

export default function KumoSettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState<ConnectStep>("idle");

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then(setProfile);
  }, []);

  const isConnected =
    profile?.kumo_token &&
    profile?.kumo_token_expires_at &&
    new Date(profile.kumo_token_expires_at) > new Date();

  const expiresIn = profile?.kumo_token_expires_at
    ? Math.max(
        0,
        Math.floor(
          (new Date(profile.kumo_token_expires_at).getTime() - Date.now()) /
            3600000
        )
      )
    : 0;

  function handleOpenKumo() {
    window.open(
      "https://app.withkumo.com",
      "kumo_login",
      "width=1100,height=700,left=200,top=100"
    );
    setStep("waiting");
  }

  async function handleConnect() {
    if (!token.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    const res = await fetch("/api/kumo/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (res.ok) {
      setSuccess(true);
      setToken("");
      setStep("idle");
      const updated = await fetch("/api/profile").then((r) => r.json());
      setProfile(updated);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to connect");
    }
    setSaving(false);
  }

  async function handleDisconnect() {
    setSaving(true);
    await fetch("/api/kumo/connect", { method: "DELETE" });
    const updated = await fetch("/api/profile").then((r) => r.json());
    setProfile(updated);
    setSuccess(false);
    setSaving(false);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Connection Status */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-3">
            Kumo Connection
            {isConnected ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-red-100 text-red-700 border-red-200">
                Disconnected
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {isConnected
              ? `Token expires in ~${expiresIn} hours`
              : "Connect your Kumo account to scrape listings"}
          </CardDescription>
        </CardHeader>
        {isConnected && (
          <CardContent>
            <Button variant="outline" onClick={handleDisconnect} disabled={saving}>
              Disconnect
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Connect / Update Token Flow */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">{isConnected ? "Update Token" : "Connect Kumo"}</CardTitle>
            <CardDescription>
              {isConnected
                ? "Replace your current token with a new one."
                : "Sign into Kumo and copy your session token to connect your account."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {success && (
              <Alert className="border-emerald-200 bg-emerald-50">
                <AlertDescription className="text-emerald-800">
                  Kumo connected successfully!
                </AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-800">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {/* Step 1: Open Kumo */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  step === "idle" ? "bg-primary text-white" : "bg-emerald-100 text-emerald-700"
                }`}>
                  {step === "idle" ? "1" : "✓"}
                </div>
                <div>
                  <p className="font-medium text-sm">Sign into Kumo</p>
                  <p className="text-xs text-muted-foreground">
                    Opens app.withkumo.com in a new window
                  </p>
                </div>
              </div>
              {step === "idle" && (
                <div className="ml-10">
                  <Button onClick={handleOpenKumo}>
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                    Open Kumo Login
                  </Button>
                </div>
              )}
            </div>

            {/* Step 2: Copy token */}
            {(step === "waiting" || step === "paste") && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      step === "waiting" ? "bg-primary text-white" : "bg-emerald-100 text-emerald-700"
                    }`}>
                      2
                    </div>
                    <div>
                      <p className="font-medium text-sm">Copy your session token</p>
                      <p className="text-xs text-muted-foreground">
                        After signing in, grab the token from Developer Tools
                      </p>
                    </div>
                  </div>

                  <div className="ml-10 bg-muted/50 rounded-lg p-4 space-y-3">
                    <p className="text-sm font-medium text-foreground">After logging into Kumo:</p>
                    <ol className="text-sm text-muted-foreground space-y-2">
                      <li className="flex gap-2">
                        <span className="font-mono text-xs bg-muted rounded px-1.5 py-0.5 shrink-0">1</span>
                        <span>Open Developer Tools — press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">F12</kbd> or <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">⌘⌥I</kbd></span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-mono text-xs bg-muted rounded px-1.5 py-0.5 shrink-0">2</span>
                        <span>Click the <strong>Network</strong> tab, then click on any request</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-mono text-xs bg-muted rounded px-1.5 py-0.5 shrink-0">3</span>
                        <span>In <strong>Request Headers</strong>, find <code className="text-xs bg-muted px-1 rounded">Authorization</code></span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-mono text-xs bg-muted rounded px-1.5 py-0.5 shrink-0">4</span>
                        <span>Copy the value — it starts with <code className="text-xs bg-muted px-1 rounded">eyJ...</code></span>
                      </li>
                    </ol>
                    <Button
                      variant="link"
                      className="text-xs p-0 h-auto text-muted-foreground"
                      onClick={() => setStep("paste")}
                    >
                      I have my token →
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Step 3: Paste token */}
            {step === "paste" && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold shrink-0">
                      3
                    </div>
                    <div>
                      <p className="font-medium text-sm">Paste your token</p>
                    </div>
                  </div>

                  <div className="ml-10 space-y-3">
                    <div className="space-y-2">
                      <Label className="text-sm">Bearer Token</Label>
                      <Input
                        type="password"
                        placeholder="eyJhbGciOiJSUzI1NiIs..."
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        className="font-mono text-sm"
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleConnect} disabled={saving || !token.trim()}>
                        {saving ? "Connecting..." : isConnected ? "Update Token" : "Connect Kumo"}
                      </Button>
                      <Button variant="ghost" onClick={() => { setStep("idle"); setToken(""); setError(null); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Shortcut: skip to paste */}
            {step === "idle" && (
              <div className="pt-2">
                <button
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setStep("paste")}
                >
                  Already have a token? Paste it directly →
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      {/* Kumo Search Filters */}
      <KumoFilterEditor profile={profile} onUpdate={(updated) => setProfile(updated)} />
    </div>
  );
}

const FILTER_DEFAULTS = {
  price: [500000, 7000000] as [number, number],
  ebitda: [0, 100000000] as [number, number],
  revenue: [0, 100000000] as [number, number],
  addedDaysAgo: "<3",
};

function KumoFilterEditor({ profile, onUpdate }: { profile: Profile | null; onUpdate: (p: Profile) => void }) {
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (profile && !initialized) {
      // Seed with defaults, then overlay any existing user filters
      const existing = (profile.kumo_filters as Record<string, unknown>) || {};
      setFilters({ ...FILTER_DEFAULTS, ...existing });
      setInitialized(true);
    }
  }, [profile, initialized]);

  function updateFilter(key: string, value: unknown) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kumo_filters: filters }),
    });
    if (res.ok) {
      const updated = await res.json();
      onUpdate(updated);
      setSaved(true);
    }
    setSaving(false);
  }

  const price = (filters.price as [number, number]) || FILTER_DEFAULTS.price;
  const ebitda = (filters.ebitda as [number, number]) || FILTER_DEFAULTS.ebitda;
  const revenue = (filters.revenue as [number, number]) || FILTER_DEFAULTS.revenue;
  const addedDaysAgo = (filters.addedDaysAgo as string) || FILTER_DEFAULTS.addedDaysAgo;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Search Filters</CardTitle>
        <CardDescription>
          Configure the Kumo search filters used when scraping listings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {saved && (
          <Alert className="border-emerald-200 bg-emerald-50">
            <AlertDescription className="text-emerald-800">
              Filters saved!
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Asking Price Min</Label>
            <Input
              type="number"
              value={price[0]}
              onChange={(e) => updateFilter("price", [Number(e.target.value), price[1]])}
            />
          </div>
          <div className="space-y-2">
            <Label>Asking Price Max</Label>
            <Input
              type="number"
              value={price[1]}
              onChange={(e) => updateFilter("price", [price[0], Number(e.target.value)])}
            />
          </div>
          <div className="space-y-2">
            <Label>EBITDA Min</Label>
            <Input
              type="number"
              value={ebitda[0]}
              onChange={(e) => updateFilter("ebitda", [Number(e.target.value), ebitda[1]])}
            />
          </div>
          <div className="space-y-2">
            <Label>EBITDA Max</Label>
            <Input
              type="number"
              value={ebitda[1]}
              onChange={(e) => updateFilter("ebitda", [ebitda[0], Number(e.target.value)])}
            />
          </div>
          <div className="space-y-2">
            <Label>Revenue Min</Label>
            <Input
              type="number"
              value={revenue[0]}
              onChange={(e) => updateFilter("revenue", [Number(e.target.value), revenue[1]])}
            />
          </div>
          <div className="space-y-2">
            <Label>Revenue Max</Label>
            <Input
              type="number"
              value={revenue[1]}
              onChange={(e) => updateFilter("revenue", [revenue[0], Number(e.target.value)])}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Recency</Label>
          <select
            className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm"
            value={addedDaysAgo}
            onChange={(e) => updateFilter("addedDaysAgo", e.target.value)}
          >
            <option value="<1">Last 1 day</option>
            <option value="<3">Last 3 days</option>
            <option value="<7">Last 7 days</option>
            <option value="<14">Last 14 days</option>
            <option value="<30">Last 30 days</option>
            <option value="<90">Last 90 days</option>
          </select>
        </div>

        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? "Saving..." : "Save Filters"}
        </Button>
      </CardContent>
    </Card>
  );
}
