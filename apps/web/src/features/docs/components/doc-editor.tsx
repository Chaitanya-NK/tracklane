"use client";

import { HistoryIcon, MoreHorizontalIcon, PencilIcon, ShapesIcon, Trash2Icon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Markdown } from "@/components/shared/markdown";
import { TimeAgo } from "@/components/shared/time-ago";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { deleteDocAction, getDocVersionAction, saveDocAction } from "../server/actions";

interface Person {
  id: string;
  name: string;
  image: string | null;
}

export interface DocValue {
  id: string;
  title: string;
  body: string;
  version: number;
  updatedAt: Date;
  updatedBy: Person | null;
  versions: {
    id: string;
    version: number;
    title: string;
    createdAt: Date;
    author: Person | null;
  }[];
}

const DIAGRAM_SNIPPET =
  "\n```mermaid\nflowchart LR\n  A[Idea] --> B{Approved?}\n  B -- yes --> C[Build]\n  B -- no --> A\n```\n";

/** A page: read view, or a Markdown editor with live preview, conflict checks and history. */
export function DocEditor({
  slug,
  doc,
  canEdit,
  startEditing,
}: {
  slug: string;
  doc: DocValue;
  canEdit: boolean;
  startEditing: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [editing, setEditing] = useState(startEditing && canEdit);
  const [title, setTitle] = useState(doc.title);
  const [body, setBody] = useState(doc.body);
  const [base, setBase] = useState(doc.version);
  const [conflict, setConflict] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const save = useAction(saveDocAction);
  const remove = useAction(deleteDocAction);
  const dirty = editing && (title !== doc.title || body !== doc.body || base !== doc.version);

  // Someone else saved while we were only reading: show their version.
  const [seen, setSeen] = useState(doc.version);
  if (!editing && doc.version !== seen) {
    setSeen(doc.version);
    setTitle(doc.title);
    setBody(doc.body);
    setBase(doc.version);
  }

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function submit(force = false) {
    const res = await save.executeAsync({
      slug,
      docId: doc.id,
      title,
      body,
      baseVersion: base,
      force,
    });
    if (res?.serverError) {
      if (res.serverError.field === "version") setConflict(res.serverError.message);
      else toast.error(res.serverError.message);
      return;
    }
    if (res?.validationErrors) return void toast.error("Give the page a title");
    if (!res?.data) return;
    setConflict(null);
    setBase(res.data.version);
    setSeen(res.data.version);
    setEditing(false);
    toast.success(res.data.changed ? `Saved version ${res.data.version}` : "No changes");
    if (startEditing) router.replace(pathname as never);
  }

  function insertDiagram() {
    const el = textarea.current;
    const at = el?.selectionStart ?? body.length;
    setBody((b) => b.slice(0, at) + DIAGRAM_SNIPPET + b.slice(at));
    requestAnimationFrame(() => el?.focus());
  }

  function cancel() {
    setTitle(doc.title);
    setBody(doc.body);
    setBase(doc.version);
    setConflict(null);
    setEditing(false);
    if (startEditing) router.replace(pathname as never);
  }

  return (
    <article className="min-w-0 space-y-4">
      {editing ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="Page title"
              className="h-10 min-w-60 flex-1 text-lg font-semibold"
              maxLength={200}
            />
            <Button variant="outline" onClick={insertDiagram}>
              <ShapesIcon />
              Diagram
            </Button>
            <Button variant="ghost" onClick={cancel}>
              Cancel
            </Button>
            <Button onClick={() => submit()} disabled={save.isPending || !title.trim()}>
              {save.isPending ? <Spinner /> : null}
              Save
            </Button>
          </div>
          {conflict ? (
            <Alert variant="destructive">
              <AlertTitle>{conflict}</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-2">
                Copy your changes, then cancel to see theirs, or save over them.
                <Button size="sm" variant="outline" onClick={() => submit(true)}>
                  Save over their version
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          <Tabs defaultValue="write" className="lg:hidden">
            <TabsList>
              <TabsTrigger value="write">Write</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            <TabsContent value="write">
              <Body value={body} onChange={setBody} onSave={() => submit()} />
            </TabsContent>
            <TabsContent value="preview" className="rounded-lg border p-4">
              <Markdown variant="document">{body || "_Nothing yet._"}</Markdown>
            </TabsContent>
          </Tabs>
          <div className="hidden gap-4 lg:grid lg:grid-cols-2">
            <Body value={body} onChange={setBody} onSave={() => submit()} ref={textarea} />
            <div
              className="max-h-[70svh] overflow-y-auto rounded-lg border p-4"
              aria-label="Preview"
            >
              <Markdown variant="document">{body || "_Nothing yet._"}</Markdown>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Markdown with tables and task lists. <Kbd>Ctrl</Kbd> <Kbd>S</Kbd> saves.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-3xl font-semibold tracking-tight">{doc.title}</h1>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                {doc.updatedBy ? <UserAvatar user={doc.updatedBy} className="size-5" /> : null}
                {doc.updatedBy?.name ?? "Someone"} · <TimeAgo date={doc.updatedAt} /> · version{" "}
                {doc.version}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {canEdit ? (
                <Button onClick={() => setEditing(true)}>
                  <PencilIcon />
                  Edit
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => setHistoryOpen(true)}>
                <HistoryIcon />
                History
              </Button>
              {canEdit ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="More page actions">
                      <MoreHorizontalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                      <Trash2Icon />
                      Delete page
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          </div>
          {doc.body ? (
            <Markdown variant="document">{doc.body}</Markdown>
          ) : (
            <p className="text-muted-foreground">
              This page is empty.{canEdit ? " Select Edit to write it." : ""}
            </p>
          )}
        </>
      )}
      <History
        slug={slug}
        doc={doc}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        canEdit={canEdit}
        onRestore={(v) => {
          setTitle(v.title);
          setBody(v.body);
          setBase(doc.version);
          setEditing(true);
          setHistoryOpen(false);
          toast.info(`Version ${v.version} loaded. Save to restore it.`);
        }}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${doc.title}?`}
        description="Its sub-pages and history are deleted too."
        pending={remove.isPending}
        onConfirm={async () => {
          const res = await remove.executeAsync({ slug, docId: doc.id });
          if (res?.serverError) toast.error(res.serverError.message);
        }}
      />
    </article>
  );
}

function Body({
  value,
  onChange,
  onSave,
  ref,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  ref?: React.Ref<HTMLTextAreaElement>;
}) {
  return (
    <Textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          onSave();
        }
      }}
      aria-label="Page content (Markdown)"
      className="min-h-[60svh] font-mono text-sm leading-6"
      placeholder={"# Heading\n\nWrite in Markdown…"}
    />
  );
}

function History({
  slug,
  doc,
  open,
  onOpenChange,
  canEdit,
  onRestore,
}: {
  slug: string;
  doc: DocValue;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  onRestore: (v: { version: number; title: string; body: string }) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const load = useAction(getDocVersionAction);
  const preview = load.result.data;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Version history</SheetTitle>
          <SheetDescription>
            Every save is kept. Open a version to read it or bring it back.
          </SheetDescription>
        </SheetHeader>
        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden px-4 pb-4 sm:grid-cols-[14rem_minmax(0,1fr)]">
          <ul className="space-y-1 overflow-y-auto">
            {doc.versions.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(v.version);
                    load.execute({ slug, docId: doc.id, version: v.version });
                  }}
                  className={cn(
                    "w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                    selected === v.version && "bg-accent",
                  )}
                >
                  <span className="font-medium">Version {v.version}</span>
                  {v.version === doc.version ? (
                    <span className="text-xs text-muted-foreground"> · current</span>
                  ) : null}
                  <span className="block text-xs text-muted-foreground">
                    {v.author?.name ?? "Someone"} · <TimeAgo date={v.createdAt} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="min-h-0 overflow-y-auto rounded-lg border p-4">
            {load.isPending ? (
              <Spinner />
            ) : preview && selected === preview.version ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{preview.title}</h3>
                  {canEdit && preview.version !== doc.version ? (
                    <Button size="sm" variant="outline" onClick={() => onRestore(preview)}>
                      Restore
                    </Button>
                  ) : null}
                </div>
                <Markdown variant="document">{preview.body || "_Empty._"}</Markdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Choose a version.</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
