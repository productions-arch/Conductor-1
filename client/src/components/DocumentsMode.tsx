import { useEffect, useRef, useState, useCallback } from "react";
import {
  FilePlus,
  FolderPlus,
  Trash2,
  FileText,
  Folder,
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  Minus,
  Search,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Check,
} from "lucide-react";
import { useDocuments, type Document, type Project } from "@/lib/documents-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function DocumentsMode() {
  const docs = useDocuments();
  const activeDoc = docs.documents.find((d) => d.id === docs.activeDocId) ?? null;

  return (
    <div className="h-full flex">
      <DocSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        {activeDoc ? (
          <DocEditor doc={activeDoc} />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function DocSidebar() {
  const docs = useDocuments();
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [newProjectName, setNewProjectName] = useState("");
  const [addingProject, setAddingProject] = useState(false);

  const filtered = docs.documents.filter((d) =>
    search ? d.title.toLowerCase().includes(search.toLowerCase()) : true
  );

  function toggleProject(id: string) {
    setCollapsed((c) => ({ ...c, [id]: !c[id] }));
  }

  function handleAddProject() {
    if (!newProjectName.trim()) return;
    const p = docs.createProject(newProjectName.trim());
    docs.setActiveProject(p.id);
    setNewProjectName("");
    setAddingProject(false);
  }

  function handleNewDoc(projectId: string) {
    docs.createDocument(projectId);
  }

  const byProject = docs.projects.map((p) => ({
    project: p,
    docs: filtered.filter((d) => d.projectId === p.id),
  }));

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-sidebar flex flex-col">
      {/* Header */}
      <div className="px-3 py-3 border-b border-border flex items-center gap-2">
        <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-xs font-semibold tracking-tight flex-1">Documents</span>
        <button
          onClick={() => setAddingProject(true)}
          className="p-1 rounded hover-elevate text-muted-foreground"
          title="New project"
        >
          <FolderPlus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="w-full bg-muted/50 border border-border rounded-md pl-6 pr-2 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Project list */}
      <nav className="flex-1 overflow-y-auto py-2 nice-scroll">
        {byProject.map(({ project, docs: pdocs }) => (
          <div key={project.id} className="mb-1">
            <div className="flex items-center gap-1 px-2 py-1 group">
              <button
                onClick={() => toggleProject(project.id)}
                className="flex items-center gap-1.5 flex-1 min-w-0 hover-elevate rounded-md px-1 py-0.5"
              >
                {collapsed[project.id]
                  ? <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  : <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />}
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                <span className="text-xs font-medium truncate">{project.name}</span>
                <span className="text-[10px] text-muted-foreground ml-1 shrink-0">{pdocs.length}</span>
              </button>
              <button
                onClick={() => handleNewDoc(project.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover-elevate text-muted-foreground"
                title="New document"
              >
                <FilePlus className="w-3.5 h-3.5" />
              </button>
            </div>

            {!collapsed[project.id] && (
              <div className="ml-4 space-y-0.5">
                {pdocs.length === 0 ? (
                  <button
                    onClick={() => handleNewDoc(project.id)}
                    className="w-full text-left px-2 py-1 text-[11px] text-muted-foreground/60 hover:text-muted-foreground italic rounded-md hover-elevate"
                  >
                    + New document
                  </button>
                ) : (
                  pdocs.map((d) => (
                    <DocListItem key={d.id} doc={d} project={project} />
                  ))
                )}
              </div>
            )}
          </div>
        ))}

        {/* Add project input */}
        {addingProject && (
          <div className="px-3 py-1">
            <input
              autoFocus
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddProject();
                if (e.key === "Escape") setAddingProject(false);
              }}
              placeholder="Project name…"
              className="w-full bg-muted/50 border border-primary/40 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        )}
      </nav>
    </aside>
  );
}

function DocListItem({ doc, project }: { doc: Document; project: Project }) {
  const docs = useDocuments();
  const active = docs.activeDocId === doc.id;

  return (
    <div
      className={`group flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer ${active ? "bg-sidebar-accent text-foreground" : "text-muted-foreground hover:text-foreground hover-elevate"}`}
      onClick={() => docs.setActiveDoc(doc.id)}
    >
      <FileText className="w-3 h-3 shrink-0" style={{ color: active ? project.color : undefined }} />
      <span className="text-xs truncate flex-1">{doc.title || "Untitled"}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover-elevate text-muted-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="w-3 h-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem
            onClick={(e) => { e.stopPropagation(); docs.deleteDocument(doc.id); }}
            className="text-destructive text-xs cursor-pointer"
          >
            <Trash2 className="w-3 h-3 mr-2" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ─── Editor ──────────────────────────────────────────────────────────────────

function DocEditor({ doc }: { doc: Document }) {
  const docs = useDocuments();
  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load content into editor when doc changes
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== doc.content) {
      editorRef.current.innerHTML = doc.content;
    }
  }, [doc.id]);

  const scheduleAutoSave = useCallback((content: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      docs.updateDocument(doc.id, { content });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }, 600);
  }, [doc.id, docs]);

  function handleInput() {
    if (!editorRef.current) return;
    scheduleAutoSave(editorRef.current.innerHTML);
  }

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    docs.updateDocument(doc.id, { title: e.target.value });
  }

  function execCmd(cmd: string, value?: string) {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
    scheduleAutoSave(editorRef.current?.innerHTML ?? "");
  }

  function insertHeading(tag: "h1" | "h2") {
    execCmd("formatBlock", tag);
  }

  const project = docs.projects.find((p) => p.id === doc.projectId);
  const dateStr = new Date(doc.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="border-b border-border px-6 py-2 flex items-center gap-1 shrink-0">
        <ToolbarBtn onClick={() => execCmd("bold")} title="Bold"><Bold className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => execCmd("italic")} title="Italic"><Italic className="w-3.5 h-3.5" /></ToolbarBtn>
        <div className="w-px h-4 bg-border mx-1" />
        <ToolbarBtn onClick={() => insertHeading("h1")} title="Heading 1"><Heading1 className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => insertHeading("h2")} title="Heading 2"><Heading2 className="w-3.5 h-3.5" /></ToolbarBtn>
        <div className="w-px h-4 bg-border mx-1" />
        <ToolbarBtn onClick={() => execCmd("insertUnorderedList")} title="Bullet list"><List className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => execCmd("insertHorizontalRule")} title="Divider"><Minus className="w-3.5 h-3.5" /></ToolbarBtn>
        <div className="flex-1" />
        {project && (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: project.color }} />
            {project.name}
          </span>
        )}
        <span className="text-[10px] text-muted-foreground ml-3">{dateStr}</span>
        {saved && (
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 ml-2">
            <Check className="w-3 h-3" /> Saved
          </span>
        )}
      </div>

      {/* Document body */}
      <div className="flex-1 overflow-y-auto nice-scroll">
        <div className="max-w-3xl mx-auto px-10 py-10">
          {/* Title */}
          <input
            ref={titleRef}
            value={doc.title}
            onChange={handleTitleChange}
            placeholder="Untitled"
            className="w-full text-4xl font-bold tracking-tight bg-transparent border-none outline-none placeholder:text-muted-foreground/40 mb-6 resize-none"
          />

          {/* Rich text body */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={(e) => {
              // Tab → indent
              if (e.key === "Tab") { e.preventDefault(); execCmd("insertText", "    "); }
            }}
            className="min-h-[400px] outline-none text-sm leading-7 text-foreground/90 prose-doc focus:outline-none"
            data-placeholder="Start writing, or push content from a chat…"
          />
        </div>
      </div>
    </div>
  );
}

function ToolbarBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 rounded hover-elevate text-muted-foreground hover:text-foreground transition-colors"
    >
      {children}
    </button>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  const docs = useDocuments();
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-4">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <FileText className="w-7 h-7 text-primary" />
      </div>
      <div>
        <h3 className="text-base font-semibold mb-1">No document open</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Create a new document or push an AI response here from Chat or Orchestrate.
        </p>
      </div>
      <button
        onClick={() => docs.createDocument("general")}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover-elevate-2"
      >
        <FilePlus className="w-4 h-4" />
        New document
      </button>
    </div>
  );
}
