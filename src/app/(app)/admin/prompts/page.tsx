"use client";

import { useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatRelativeTime } from "@/lib/format";
import type { PromptTemplate } from "@/types";

export default function AdminPromptsPage() {
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);

  async function fetchPrompts() {
    const res = await fetch("/api/admin/prompts");
    if (res.ok) {
      const data = await res.json();
      setPrompts(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchPrompts();
  }, []);

  const activePrompt = prompts.find((p) => p.is_active);

  function openEditor() {
    setName("");
    setSystemPrompt(activePrompt?.system_prompt || "");
    setNotes("");
    setEditorOpen(true);
  }

  async function publishVersion() {
    setSaving(true);
    await fetch("/api/admin/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        system_prompt: systemPrompt,
        notes: notes || undefined,
      }),
    });
    setSaving(false);
    setEditorOpen(false);
    await fetchPrompts();
  }

  async function activateVersion(id: string) {
    await fetch(`/api/admin/prompts/${id}/activate`, {
      method: "PATCH",
    });
    await fetchPrompts();
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Active prompt */}
      {activePrompt && (
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {activePrompt.name}
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                    Active (v{activePrompt.version})
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Created {formatRelativeTime(activePrompt.created_at)}
                  {activePrompt.notes && ` · ${activePrompt.notes}`}
                </CardDescription>
              </div>
              <Button onClick={openEditor}>Edit Prompt</Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted/50 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono max-h-80 overflow-y-auto">
              {activePrompt.system_prompt}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Publish New Prompt Version</DialogTitle>
          </DialogHeader>
          <Alert className="border-amber-200 bg-amber-50">
            <AlertDescription className="text-amber-800 text-sm">
              Publishing a new version will mark all existing evaluations as
              stale.
            </AlertDescription>
          </Alert>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Version Name</Label>
              <Input
                placeholder="e.g., Scoring Rubric v3 - adjusted weights"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>System Prompt</Label>
              <Textarea
                className="font-mono text-xs min-h-[300px]"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                placeholder="What changed in this version?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <Button
              onClick={publishVersion}
              disabled={saving || !name || !systemPrompt}
            >
              {saving ? "Publishing..." : "Publish New Version"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Version history */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Version History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {prompts.map((p) => (
            <div
              key={p.id}
              className="border rounded-lg p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">v{p.version}</span>
                  <span className="text-sm text-muted-foreground">
                    {p.name}
                  </span>
                  {p.is_active && (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                      Active
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(p.created_at)}
                  </span>
                  {!p.is_active && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => activateVersion(p.id)}
                    >
                      Activate
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setExpandedVersion(
                        expandedVersion === p.version ? null : p.version
                      )
                    }
                  >
                    {expandedVersion === p.version ? "Hide" : "View"}
                  </Button>
                </div>
              </div>
              {expandedVersion === p.version && (
                <pre className="text-xs bg-muted/50 p-3 rounded overflow-x-auto whitespace-pre-wrap font-mono max-h-60 overflow-y-auto">
                  {p.system_prompt}
                </pre>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
