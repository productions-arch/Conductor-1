import { createContext, useContext, useState, type ReactNode } from "react";

export interface Project {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface Document {
  id: string;
  projectId: string;
  title: string;
  content: string; // HTML string
  createdAt: string;
  updatedAt: string;
}

interface DocumentsState {
  projects: Project[];
  documents: Document[];
  activeDocId: string | null;
  activeProjectId: string | null;
}

interface DocumentsActions {
  createProject: (name: string) => Project;
  deleteProject: (id: string) => void;
  createDocument: (projectId: string, title?: string, content?: string) => Document;
  updateDocument: (id: string, patch: Partial<Pick<Document, "title" | "content">>) => void;
  deleteDocument: (id: string) => void;
  setActiveDoc: (id: string | null) => void;
  setActiveProject: (id: string | null) => void;
}

const PROJECT_COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function now() {
  return new Date().toISOString();
}

const DEFAULT_PROJECT: Project = {
  id: "general",
  name: "General",
  color: "#10b981",
  createdAt: new Date().toISOString(),
};

const DocumentsContext = createContext<DocumentsState & DocumentsActions | null>(null);

export function DocumentsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([DEFAULT_PROJECT]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>("general");

  function createProject(name: string): Project {
    const p: Project = {
      id: uid(),
      name,
      color: PROJECT_COLORS[projects.length % PROJECT_COLORS.length],
      createdAt: now(),
    };
    setProjects((ps) => [...ps, p]);
    return p;
  }

  function deleteProject(id: string) {
    if (id === "general") return;
    setProjects((ps) => ps.filter((p) => p.id !== id));
    setDocuments((ds) => ds.filter((d) => d.projectId !== id));
    if (activeProjectId === id) setActiveProjectId("general");
  }

  function createDocument(projectId: string, title = "Untitled", content = ""): Document {
    const d: Document = { id: uid(), projectId, title, content, createdAt: now(), updatedAt: now() };
    setDocuments((ds) => [d, ...ds]);
    setActiveDocId(d.id);
    setActiveProjectId(projectId);
    return d;
  }

  function updateDocument(id: string, patch: Partial<Pick<Document, "title" | "content">>) {
    setDocuments((ds) =>
      ds.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: now() } : d))
    );
  }

  function deleteDocument(id: string) {
    setDocuments((ds) => ds.filter((d) => d.id !== id));
    if (activeDocId === id) setActiveDocId(null);
  }

  return (
    <DocumentsContext.Provider value={{
      projects, documents, activeDocId, activeProjectId,
      createProject, deleteProject, createDocument, updateDocument, deleteDocument,
      setActiveDoc: setActiveDocId, setActiveProject: setActiveProjectId,
    }}>
      {children}
    </DocumentsContext.Provider>
  );
}

export function useDocuments() {
  const ctx = useContext(DocumentsContext);
  if (!ctx) throw new Error("useDocuments must be inside DocumentsProvider");
  return ctx;
}
