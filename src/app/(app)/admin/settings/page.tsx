"use client";

import { useEffect, useState } from "react";
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
import { cn } from "@/lib/utils";

const TABS = [
  { id: "scrape", label: "Scraping" },
  { id: "evaluate", label: "Evaluation" },
  { id: "rate_limit", label: "Rate Limits" },
];

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("scrape");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        setLoading(false);
      });
  }, []);

  async function saveSection(keys: string[]) {
    const sectionName = keys[0].split(".")[0];
    setSaving(sectionName);
    const payload: Record<string, unknown> = {};
    for (const key of keys) {
      payload[key] = settings[key];
    }

    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: payload }),
    });
    setSaving(null);
    setSaved(sectionName);
    setTimeout(() => setSaved(null), 2000);
  }

  function updateSetting(key: string, value: unknown) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900 mb-1">System Settings</h1>
      <p className="text-sm text-gray-500 mb-5">Configure scraping, evaluation, and rate limits</p>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Scraping */}
      {activeTab === "scrape" && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Scrape Configuration</CardTitle>
            <CardDescription>Configure automated scraping behavior</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Detail Fetch Concurrency</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={(settings["scrape.concurrency"] as number) || 5}
                onChange={(e) => updateSetting("scrape.concurrency", Number(e.target.value))}
              />
            </div>
            <SaveButton
              onClick={() => saveSection(["scrape.concurrency"])}
              saving={saving === "scrape"}
              saved={saved === "scrape"}
            />
          </CardContent>
        </Card>
      )}

      {/* Evaluation */}
      {activeTab === "evaluate" && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Evaluation Configuration</CardTitle>
            <CardDescription>Configure AI evaluation settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Claude Model</Label>
              <Input
                value={(settings["evaluate.model"] as string) || ""}
                onChange={(e) => updateSetting("evaluate.model", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Max Output Tokens</Label>
                <Input
                  type="number"
                  value={(settings["evaluate.max_tokens"] as number) || 300}
                  onChange={(e) => updateSetting("evaluate.max_tokens", Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Concurrency</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={(settings["evaluate.concurrency"] as number) || 5}
                  onChange={(e) => updateSetting("evaluate.concurrency", Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Calibration</Label>
                <Input
                  type="number"
                  min={0}
                  max={20}
                  value={(settings["evaluate.calibration_max"] as number) || 10}
                  onChange={(e) => updateSetting("evaluate.calibration_max", Number(e.target.value))}
                />
              </div>
            </div>
            <SaveButton
              onClick={() => saveSection(["evaluate.model", "evaluate.max_tokens", "evaluate.concurrency", "evaluate.calibration_max"])}
              saving={saving === "evaluate"}
              saved={saved === "evaluate"}
            />
          </CardContent>
        </Card>
      )}

      {/* Rate Limits */}
      {activeTab === "rate_limit" && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Rate Limits</CardTitle>
            <CardDescription>Configure API rate limits per user</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: "rate_limit.general", label: "General API" },
              { key: "rate_limit.scrape", label: "Scrape Trigger" },
              { key: "rate_limit.evaluate", label: "Evaluation" },
              { key: "rate_limit.export", label: "CSV Export" },
            ].map((rl) => {
              const val = (settings[rl.key] as { requests: number; window_seconds: number }) || {
                requests: 100,
                window_seconds: 60,
              };
              return (
                <div key={rl.key} className="grid grid-cols-3 gap-3 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">{rl.label}</Label>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Requests</Label>
                    <Input
                      type="number"
                      value={val.requests}
                      onChange={(e) =>
                        updateSetting(rl.key, { ...val, requests: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Window (sec)</Label>
                    <Input
                      type="number"
                      value={val.window_seconds}
                      onChange={(e) =>
                        updateSetting(rl.key, { ...val, window_seconds: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
              );
            })}
            <SaveButton
              onClick={() => saveSection(["rate_limit.general", "rate_limit.scrape", "rate_limit.evaluate", "rate_limit.export"])}
              saving={saving === "rate_limit"}
              saved={saved === "rate_limit"}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SaveButton({ onClick, saving, saved }: { onClick: () => void; saving: boolean; saved: boolean }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <Button onClick={onClick} disabled={saving} size="sm">
        {saving ? "Saving..." : "Save"}
      </Button>
      {saved && <span className="text-sm text-emerald-600">Saved!</span>}
    </div>
  );
}

