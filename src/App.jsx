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

// Configuración del worker de PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

// URL del backend (añádela a frontend/.env → VITE_API_BASE=...)
const API_BASE = import.meta.env.VITE_API_BASE || "";

export default function App() {
  // Mensaje de bienvenida
  const initialGreeting =
    "👋 ¡Hola! Soy ArbitrIA. 🤖 Estoy listo para ayudarte con cualquier consulta técnica acerca del reglamento del fútbol ⚽️!";
  const [history, setHistory] = useState([
    { role: "assistant", content: initialGreeting },
  ]);
  const [fragments, setFragments] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const chatEndRef = useRef(null);

  // Scroll al último mensaje
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  // Buscar fragmento en PDF cuando cambia `selected`, usando chunking para mayor robustez
  useEffect(() => {
    if (!selected) return;
    (async () => {
      try {
        const pdf = await getDocument(selected.pdf_url).promise;

        // 1) Normalizar y acortar texto a 120 chars
        const clean = selected.texto
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase()
          .slice(0, 120);

        // 2) Crear chunks de 40 chars solapados
        const chunkSize = 40;
        const chunks = [];
        for (let start = 0; start < clean.length; start += chunkSize / 2) {
          chunks.push(clean.substr(start, chunkSize));
        }

        // 3) Recorrer páginas y buscar alguno de los chunks
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const { items } = await page.getTextContent();
          const haystack = items
            .map((it) => it.str)
            .join(" ")
            .replace(/\s+/g, " ")
            .toLowerCase();

          // Si algún chunk coincide, tenemos la página
          if (chunks.some((c) => haystack.includes(c))) {
            setPageNumber(i);
            return;
          }
        }

        // Fallback a página 1
        setPageNumber(1);
      } catch (err) {
        console.error("Búsqueda en PDF falló:", err);
        setPageNumber(1);
      }
    })();
  }, [selected]);

  // Enviar consulta
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
        { role: "assistant", content: "⚠️ Ha ocurrido un error. Inténtalo de nuevo." },
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

  return (
    <div
      style={{ fontFamily: "Montserrat, sans-serif" }}
      className="h-screen flex flex-col bg-gray-50"
    >
      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="max-w-4xl mx-auto py-4 px-4 flex flex-col items-center">
          <h1 className="text-2xl font-semibold text-gray-800">
            ⚖️ ArbitrIA, tu IA especializada en reglamento de fútbol
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Desarrollado por{" "}
            <a
              href="https://caeys.es"
              className="text-indigo-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Caeys.es
            </a>
          </p>
        </div>
      </header>


      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Chat Area */}
        <section className="w-full lg:w-2/3 flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {history.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`px-4 py-2 rounded-lg max-w-[70%] whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {m.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </motion.div>
            ))}

            {loading && (
              <div className="flex items-center justify-center text-gray-500">
                <Loader2 className="animate-spin w-5 h-5 mr-2" />
                Procesando…
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 p-4 bg-white">
            <div className="flex items-center space-x-3">
              <textarea
                rows={2}
                className="flex-1 resize-none px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Haz una pregunta sobre reglamentos arbitrales…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKey}
              />
              <button
                onClick={sendMessage}
                disabled={loading}
                className="p-3 bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="animate-spin w-5 h-5 text-white" />
                ) : (
                  <CornerDownLeft className="w-5 h-5 text-white" />
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Fragments & PDF */}
        <aside className="flex flex-col w-full lg:w-1/3 border-t lg:border-l border-gray-200 bg-white">
          {fragments.length > 0 ? (
            <Tabs.Root defaultValue="0" className="flex flex-col h-full">
              <Tabs.List className="flex space-x-2 overflow-x-auto p-4">
                {fragments.map((frag, idx) => (
                  <Tabs.Trigger
                    key={idx}
                    value={`${idx}`}
                    onClick={() => setSelected(frag)}
                    className="px-3 py-1 text-sm font-medium rounded-full hover:bg-gray-100 data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-600"
                  >
                    Fragmento {idx + 1}{" "}
                    <span className="ml-1 text-xs text-gray-500">
                      ({(frag.score * 100).toFixed(1)}%)
                    </span>
                  </Tabs.Trigger>
                ))}
              </Tabs.List>

              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-4 flex flex-col space-y-2 border-b border-gray-200 overflow-y-auto">
                  <p className="text-sm font-semibold text-gray-700">
                    📄 {selected?.nombre_original}
                  </p>
                  <p className="text-xs text-gray-500">
                    Relevancia: {(selected?.score * 100).toFixed(1)}%
                  </p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                    {selected?.texto}
                  </p>
                  <button
                    onClick={() => window.open(selected?.pdf_url, "_blank")}
                    className="inline-flex items-center text-sm font-medium text-indigo-600 hover:underline"
                  >
                    <ExternalLink className="w-4 h-4 mr-1" /> Abrir PDF completo
                  </button>
                </div>

                <div className="flex-1 p-4 flex items-center justify-center overflow-auto">
                  {selected?.pdf_url ? (
                    <div className="w-full overflow-auto rounded-lg">
                      <Document file={selected.pdf_url}>
                        <Page pageNumber={pageNumber} width={600} />
                      </Document>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-gray-400">
                      <FileText className="w-10 h-10 mb-3" />
                      <span>Selecciona un fragmento para ver el PDF</span>
                    </div>
                  )}
                </div>
              </div>
            </Tabs.Root>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              No hay fragmentos para mostrar todavía.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
