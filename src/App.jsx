// App.jsx – React front-end para “Asistente de Reglamento Arbitral”
import React, { useState, useEffect, useRef } from "react";
import { Loader2, FileText, ExternalLink, CornerDownLeft } from "lucide-react";
import { motion } from "framer-motion";
import { Document, Page, pdfjs } from "react-pdf";
import { getDocument } from "pdfjs-dist";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import * as Tabs from "@radix-ui/react-tabs";

// Worker de PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

// URL del backend (añádela a frontend/.env → VITE_API_BASE=...)
const API_BASE = import.meta.env.VITE_API_BASE || "";

export default function App() {
  const [history, setHistory] = useState([]);
  const [fragments, setFragments] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);  // fragmento activo
  const [pageNumber, setPageNumber] = useState(1); // página a mostrar
  const chatEndRef = useRef(null);

  /* ---------- scroll al último mensaje ---------- */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  /* ---------- buscar fragmento en PDF cuando cambia `selected` ---------- */
  useEffect(() => {
    if (!selected) return;

    // IIFE async
    (async () => {
      try {
        /* 1. carga el PDF completo */
        const pdf = await getDocument(`${API_BASE}${selected.pdf_url}`).promise;

        /* 2. normaliza el texto del fragmento (primeros 120 chars) */
        const needle = selected.texto
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase()
          .slice(0, 120);

        /* 3. recorre las páginas hasta encontrar coincidencia */
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const { items } = await page.getTextContent();
          const haystack = items
            .map((it) => it.str)
            .join(" ")
            .replace(/\s+/g, " ")
            .toLowerCase();

          if (haystack.includes(needle)) {
            setPageNumber(i);
            return;
          }
        }
        // si no lo encuentra, mostrar página 1
        setPageNumber(1);
      } catch (err) {
        console.error("Búsqueda en PDF falló:", err);
        setPageNumber(1);
      }
    })();
  }, [selected]);

  /* ---------- enviar consulta ---------- */
  const sendMessage = async () => {
    if (!query.trim()) return;
    const newHist = [...history, { role: "user", content: query }];
    setHistory(newHist);
    setQuery("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, history: newHist }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { answer, fragments } = await res.json();
      setFragments(fragments || []);
      setHistory((h) => [...h, { role: "assistant", content: answer }]);
    } catch (e) {
      console.error(e);
      setHistory((h) => [
        ...h,
        { role: "assistant", content: "⚠️ Ha ocurrido un error. Intenta de nuevo." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /* ---------- UI ---------- */
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="py-4 bg-white shadow">
        <h1 className="text-center text-2xl font-bold">⚖️ Asistente de Reglamento Arbitral</h1>
      </header>

      <div className="flex-1 grid grid-cols-1 xl:grid-cols-3">
        {/* Chat */}
        <div className="col-span-2 flex flex-col">
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {history.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div
                  className={`max-w-md p-4 rounded-lg ${
                    m.role === "user" ? "bg-gray-100 self-end" : "bg-blue-50 self-start"
                  }`}
                >
                  <div
                    className={`prose prose-sm ${
                      m.role === "assistant" ? "prose-blue" : "prose-gray"
                    }`}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]} children={m.content} />
                  </div>
                </div>
              </motion.div>
            ))}

            {loading && (
              <div className="flex items-center space-x-2 text-gray-500">
                <Loader2 className="animate-spin" /> <span>Procesando…</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="border-t p-4 flex items-end space-x-2">
            <textarea
              className="flex-1 border rounded p-2 resize-none"
              rows={2}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Haz una pregunta sobre reglamentos arbitrales…"
            />
            <button
              onClick={sendMessage}
              disabled={loading}
              className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" /> : <CornerDownLeft />}
            </button>
          </div>
        </div>

        {/* Fragmentos + PDF */}
        <aside className="border-l flex flex-col">
          {fragments.length > 0 ? (
            <Tabs.Root defaultValue="0" className="flex-1 flex flex-col">
              <Tabs.List className="flex space-x-2 overflow-x-auto p-2 bg-white">
                {fragments.map((_, idx) => (
                  <Tabs.Trigger
                    key={idx}
                    value={`${idx}`}
                    onClick={() => setSelected(fragments[idx])}
                    className="px-3 py-1 bg-gray-200 rounded"
                  >
                    Fragmento {idx + 1}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>

              <div className="flex-1 flex flex-col">
                <div className="overflow-auto p-4 space-y-2 border-b">
                  <p className="text-sm font-semibold">📄 {selected?.nombre_original}</p>
                  <p className="whitespace-pre-wrap">{selected?.texto}</p>
                  <button
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                    onClick={() => window.open(`${API_BASE}${selected?.pdf_url}`, "_blank")}
                  >
                    <ExternalLink className="w-4 h-4" /> Abrir PDF completo
                  </button>
                </div>

                <div className="flex-1 overflow-auto p-4 bg-gray-100 flex items-center justify-center">
                  {selected?.pdf_url ? (
                    <Document file={selected.pdf_url} className="w-full h-full">
                      <Page pageNumber={pageNumber} width={600} />
                    </Document>
                  ) : (
                    <div className="flex flex-col items-center text-gray-500">
                      <FileText className="w-8 h-8 mb-2" />
                      <span>Selecciona un fragmento para ver el PDF</span>
                    </div>
                  )}
                </div>
              </div>
            </Tabs.Root>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              No hay fragmentos para mostrar todavía.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
