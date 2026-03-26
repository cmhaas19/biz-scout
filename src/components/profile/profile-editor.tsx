"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { BuyerProfile, Profile } from "@/types";

export function ProfileEditor({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [bp, setBp] = useState<BuyerProfile>(profile.buyer_profile || {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(fn: (draft: BuyerProfile) => void) {
    setBp((prev) => {
      const next = { ...prev };
      fn(next);
      return next;
    });
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buyer_profile: bp }),
    });
    if (res.ok) {
      setSaved(true);
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to save");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      {saved && (
        <Alert className="border-emerald-200 bg-emerald-50">
          <AlertDescription className="text-emerald-800">
            Profile saved. Existing evaluations will be marked as stale.
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* Acquisition Target */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Acquisition Target</CardTitle>
          <CardDescription>What are you looking to acquire?</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Describe your ideal acquisition..."
            value={bp.acquisition_target || ""}
            onChange={(e) =>
              update((d) => {
                d.acquisition_target = e.target.value;
              })
            }
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Industries */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Industries of Focus</CardTitle>
          <CardDescription>
            Add industries you&apos;re interested in
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(bp.industries || []).map((ind, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
              >
                {ind}
                <button
                  className="ml-1 text-primary/60 hover:text-primary"
                  onClick={() =>
                    update((d) => {
                      d.industries = d.industries?.filter((_, j) => j !== i);
                    })
                  }
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <Input
            placeholder="Type an industry and press Enter"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const val = (e.target as HTMLInputElement).value.trim();
                if (val) {
                  update((d) => {
                    d.industries = [...(d.industries || []), val];
                  });
                  (e.target as HTMLInputElement).value = "";
                }
              }
            }}
          />
        </CardContent>
      </Card>

      {/* Financials */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Size & Financials</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>EBITDA Min</Label>
              <Input
                type="number"
                placeholder="400000"
                value={bp.financials?.ebitda_min ?? ""}
                onChange={(e) =>
                  update((d) => {
                    d.financials = {
                      ...d.financials,
                      ebitda_min: e.target.value ? Number(e.target.value) : undefined,
                    };
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>EBITDA Max</Label>
              <Input
                type="number"
                placeholder="1500000"
                value={bp.financials?.ebitda_max ?? ""}
                onChange={(e) =>
                  update((d) => {
                    d.financials = {
                      ...d.financials,
                      ebitda_max: e.target.value ? Number(e.target.value) : undefined,
                    };
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Revenue Min</Label>
              <Input
                type="number"
                placeholder="2000000"
                value={bp.financials?.revenue_min ?? ""}
                onChange={(e) =>
                  update((d) => {
                    d.financials = {
                      ...d.financials,
                      revenue_min: e.target.value ? Number(e.target.value) : undefined,
                    };
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Revenue Max</Label>
              <Input
                type="number"
                placeholder="20000000"
                value={bp.financials?.revenue_max ?? ""}
                onChange={(e) =>
                  update((d) => {
                    d.financials = {
                      ...d.financials,
                      revenue_max: e.target.value ? Number(e.target.value) : undefined,
                    };
                  })
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Max Asking Price</Label>
              <Input
                type="number"
                placeholder="5000000"
                value={bp.financials?.max_asking_price ?? ""}
                onChange={(e) =>
                  update((d) => {
                    d.financials = {
                      ...d.financials,
                      max_asking_price: e.target.value ? Number(e.target.value) : undefined,
                    };
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Geography */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Geography</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Primary Location</Label>
            <Input
              placeholder="San Diego County & Southern California"
              value={bp.geography?.primary || ""}
              onChange={(e) =>
                update((d) => {
                  d.geography = { ...d.geography, primary: e.target.value };
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Secondary / Remote</Label>
            <Input
              placeholder="Online businesses operable from primary location"
              value={bp.geography?.secondary || ""}
              onChange={(e) =>
                update((d) => {
                  d.geography = { ...d.geography, secondary: e.target.value };
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Business Characteristics */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Business Characteristics</CardTitle>
          <CardDescription>Qualities you value in an acquisition</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(bp.business_characteristics || []).map((char, i) => (
            <div key={i} className="flex items-center gap-3">
              <Checkbox
                checked={char.enabled}
                onCheckedChange={(checked) =>
                  update((d) => {
                    if (d.business_characteristics) {
                      d.business_characteristics[i] = {
                        ...d.business_characteristics[i],
                        enabled: !!checked,
                      };
                    }
                  })
                }
              />
              <span className="text-sm flex-1">{char.label}</span>
              <button
                className="text-muted-foreground hover:text-destructive text-sm"
                onClick={() =>
                  update((d) => {
                    d.business_characteristics =
                      d.business_characteristics?.filter((_, j) => j !== i);
                  })
                }
              >
                ×
              </button>
            </div>
          ))}
          <Input
            placeholder="Add a characteristic and press Enter"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const val = (e.target as HTMLInputElement).value.trim();
                if (val) {
                  update((d) => {
                    d.business_characteristics = [
                      ...(d.business_characteristics || []),
                      { label: val, enabled: true },
                    ];
                  });
                  (e.target as HTMLInputElement).value = "";
                }
              }
            }}
          />
        </CardContent>
      </Card>

      {/* Deal Structure */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Deal Structure Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Describe your preferred deal structure..."
            value={bp.deal_structure || ""}
            onChange={(e) =>
              update((d) => {
                d.deal_structure = e.target.value;
              })
            }
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Financing */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Financing Capacity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>SBA Pre-approval</Label>
              <Input
                type="number"
                placeholder="5000000"
                value={bp.financing?.sba_preapproval ?? ""}
                onChange={(e) =>
                  update((d) => {
                    d.financing = {
                      ...d.financing,
                      sba_preapproval: e.target.value ? Number(e.target.value) : undefined,
                    };
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Liquid Assets</Label>
              <Input
                type="number"
                placeholder="2000000"
                value={bp.financing?.liquid_assets ?? ""}
                onChange={(e) =>
                  update((d) => {
                    d.financing = {
                      ...d.financing,
                      liquid_assets: e.target.value ? Number(e.target.value) : undefined,
                    };
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Equity Contribution Min %</Label>
              <Input
                type="number"
                placeholder="20"
                value={bp.financing?.equity_contribution_pct_min ?? ""}
                onChange={(e) =>
                  update((d) => {
                    d.financing = {
                      ...d.financing,
                      equity_contribution_pct_min: e.target.value ? Number(e.target.value) : undefined,
                    };
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Equity Contribution Max %</Label>
              <Input
                type="number"
                placeholder="30"
                value={bp.financing?.equity_contribution_pct_max ?? ""}
                onChange={(e) =>
                  update((d) => {
                    d.financing = {
                      ...d.financing,
                      equity_contribution_pct_max: e.target.value ? Number(e.target.value) : undefined,
                    };
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Operator Background */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Operator Background</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Your relevant experience and background..."
            value={bp.operator_background || ""}
            onChange={(e) =>
              update((d) => {
                d.operator_background = e.target.value;
              })
            }
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Disqualifying Factors */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Disqualifying Factors</CardTitle>
          <CardDescription>
            Hard dealbreakers that should cap the score at 25
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(bp.disqualifying_factors || []).map((factor, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-sm flex-1">{factor}</span>
              <button
                className="text-muted-foreground hover:text-destructive text-sm"
                onClick={() =>
                  update((d) => {
                    d.disqualifying_factors =
                      d.disqualifying_factors?.filter((_, j) => j !== i);
                  })
                }
              >
                ×
              </button>
            </div>
          ))}
          <Input
            placeholder="Add a disqualifier and press Enter"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const val = (e.target as HTMLInputElement).value.trim();
                if (val) {
                  update((d) => {
                    d.disqualifying_factors = [
                      ...(d.disqualifying_factors || []),
                      val,
                    ];
                  });
                  (e.target as HTMLInputElement).value = "";
                }
              }
            }}
          />
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? "Saving..." : "Save Profile"}
        </Button>
      </div>
    </div>
  );
}
