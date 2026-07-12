import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";
import { X, FileText } from "lucide-react";
import { api } from "../../api/client";
import { useApp } from "../../stores/app";
import { Spinner } from "../ui/Controls";

export function FilePreview({
  skillPath,
  filePath,
  onClose,
}: {
  skillPath: string;
  filePath: string;
  onClose: () => void;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [binary, setBinary] = useState<{ type: string; base64: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const theme = useApp((s) => s.settings.theme);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const fileData = await api.readSkillFileData(skillPath, filePath);
        if (!active) return;

        const ext = filePath.split(".").pop()?.toLowerCase() || "txt";

        if (!fileData.isText) {
          const type =
            ext === "png"
              ? "image/png"
              : ext === "jpg" || ext === "jpeg"
                ? "image/jpeg"
                : ext === "webp"
                  ? "image/webp"
                  : ext === "gif"
                    ? "image/gif"
                    : ext === "svg"
                      ? "image/svg+xml"
                      : "application/octet-stream";
          setBinary({ type, base64: fileData.content });
          return;
        }

        const text = fileData.content;
        setContent(text);

        // infer language from extension
        const langMap: Record<string, string> = {
          js: "javascript",
          ts: "typescript",
          json: "json",
          md: "markdown",
          py: "python",
          rs: "rust",
          html: "html",
          css: "css",
          sh: "bash",
          yaml: "yaml",
          yml: "yaml",
        };
        const lang = langMap[ext] || "text";

        const highlighted = await codeToHtml(text, {
          lang,
          theme: theme === "dark" ? "vitesse-dark" : "vitesse-light",
        });

        if (!active) return;
        setHtml(highlighted);
      } catch (err) {
        if (!active) return;
        setError(String(err));
      }
    })();
    return () => {
      active = false;
    };
  }, [skillPath, filePath, theme]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-8 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-[900px] flex-col overflow-hidden rounded-[8px] border border-border-strong bg-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3 bg-surface">
          <FileText className="size-4 text-faint" />
          <span className="text-sm font-medium text-text">{filePath}</span>
          <button
            onClick={onClose}
            className="ml-auto flex size-6 items-center justify-center rounded-[5px] text-faint hover:bg-hover hover:text-text transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-surface-2 p-4 text-sm font-mono relative">
          {error ? (
            <div className="text-danger">{error}</div>
          ) : binary ? (
            binary.type.startsWith("image/") ? (
              <div className="flex h-full items-center justify-center p-4">
                <img
                  src={`data:${binary.type};base64,${binary.base64}`}
                  alt={filePath}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            ) : (
              <div className="text-faint">Cannot preview binary file</div>
            )
          ) : html ? (
            <div
              className="shiki-preview text-xs sm:text-sm whitespace-pre-wrap break-words [&>pre]:!bg-transparent [&>pre]:!m-0 [&>pre]:!whitespace-pre-wrap [&>pre]:!break-words"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : content ? (
            <div className="text-xs sm:text-sm whitespace-pre-wrap break-words text-text">
              {content}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-faint gap-2">
              <Spinner className="size-4" />
              Loading file...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
