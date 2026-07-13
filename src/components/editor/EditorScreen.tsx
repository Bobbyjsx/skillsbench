import { useCallback, useEffect, useState } from "react";
import { marked } from "marked";
import { ArrowLeft, Eye, FileText, Save } from "lucide-react";
import { useApp } from "../../stores/app";
import { api } from "../../api/client";
import { Button, IconButton } from "../ui/Button";
import { makePathDisplay } from "../../lib/paths";
import { toast } from "../../stores/toasts";

function mdxToMarkdown(src: string): string {
  const lines = src.split("\n");
  const out: string[] = [];
  let inFence = false;
  for (const line of lines) {
    const t = line.trimStart();
    if (t.startsWith("```")) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    if (/^(import|export)\s/.test(t)) continue;
    if (/^<\/?[A-Z][^>]*>\s*$/.test(t)) continue;
    const cleaned = line
      .replace(/<\/?[A-Z][A-Za-z0-9]*(?:\s[^>]*)?\/?>/g, "")
      .replace(/\{([^{}]+)\}/g, "$1");
    out.push(cleaned);
  }
  return out.join("\n");
}

export function EditorScreen() {
  const app = useApp();
  const target = app.editorTarget;
  const [original, setOriginal] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [html, setHtml] = useState("");

  useEffect(() => {
    if (!target) return;
    setPreview(false);
    api
      .readSkillFile(target.path, target.file)
      .then((c) => {
        setOriginal(c);
        setContent(c);
      })
      .catch((err) => toast.error(String(err)));
  }, [target?.path, target?.file]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (preview && content) {
      setHtml(marked.parse(mdxToMarkdown(content)) as string);
    }
  }, [preview, content]);

  const save = useCallback(async () => {
    if (!target) return;
    setSaving(true);
    try {
      const ok = await api.writeSkillFile(target.path, target.file, content);
      if (ok) {
        toast.success("Saved", target.file);
        setOriginal(content);
      } else {
        toast.error("Save refused — the file has moved", "Run a scan and try again");
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  }, [target, content]);

  const dirty = content !== original;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty && target) save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, target, save]);

  if (!target) return null;

  const close = () => {
    if (dirty) {
      const ok = window.confirm("Discard unsaved changes?");
      if (!ok) return;
    }
    app.closeEditor();
  };

  const display = makePathDisplay(app.home);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <IconButton label="Back" onClick={close}>
          <ArrowLeft className="size-3.5" />
        </IconButton>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-text">{target.file}</span>
            {dirty && (
              <span className="flex items-center gap-1 rounded-[4px] bg-warning/15 px-1.5 py-0.5 text-2xs font-medium text-warning">
                unsaved
              </span>
            )}
          </div>
          <div className="truncate font-mono text-2xs text-faint">
            {display.display(target.path)}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="subtle" onClick={() => setPreview((p) => !p)}>
            {preview ? <FileText className="size-3.5" /> : <Eye className="size-3.5" />}
            {preview ? "Source" : "Preview"}
          </Button>
          <Button size="sm" onClick={save} disabled={saving || !dirty}>
            <Save className="size-3.5" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1">
        {!preview && (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            className="h-full resize-none bg-bg p-4 font-mono text-xs leading-relaxed text-text caret-accent focus:outline-none"
            placeholder="# SKILL.md"
          />
        )}
        {preview && (
          <div className="min-h-0 overflow-y-auto bg-bg">
            <article
              className="mx-auto max-w-[560px] px-6 py-5 text-sm leading-relaxed text-text md-editor"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
