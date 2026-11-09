"use client";

import { useTheme } from "next-themes";
import { useEffect, useId, useState } from "react";

/**
 * Renders a ```mermaid block. Mermaid loads on first use (it's large) and runs in strict mode,
 * so diagram text can't add scripts or links that run code.
 */
export function MermaidDiagram({ code }: { code: string }) {
  const id = `mermaid-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const { resolvedTheme } = useTheme();
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: resolvedTheme === "dark" ? "dark" : "neutral",
          fontFamily: "inherit",
        });
        const { svg } = await mermaid.render(id, code);
        if (!cancelled) {
          setSvg(svg);
          setError(null);
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message.split("\n")[0]! : "Invalid diagram");
        // Mermaid leaves its error graphic in the body; remove it.
        document.getElementById(`d${id}`)?.remove();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, id, resolvedTheme]);

  if (error) {
    return (
      <div className="my-2 rounded-md border border-destructive/40 p-3 text-xs">
        <p className="font-medium text-destructive">Diagram error: {error}</p>
        <pre className="mt-2 overflow-x-auto font-mono text-muted-foreground">{code}</pre>
      </div>
    );
  }
  if (!svg)
    return (
      <div className="my-2 h-32 animate-pulse rounded-md bg-muted" aria-label="Loading diagram" />
    );
  return (
    <figure
      className="my-3 flex justify-center overflow-x-auto rounded-md border bg-card p-3 [&_svg]:h-auto [&_svg]:max-w-full"
      role="img"
      aria-label="Diagram"
      // Mermaid's output in strict mode is sanitised SVG.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
