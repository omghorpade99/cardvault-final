import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive, ArrowLeft, Check, CheckSquare, ChevronLeft, ChevronRight, CircleHelp, Clock3,
  Download, ImagePlus, Pencil, Plus, Search, ShieldCheck, Sparkles, Square,
  Trash2, UploadCloud, X, ZoomIn,
} from "lucide-react";
import { api } from "./api";
import CameraCapture from "./components/CameraCapture";
import EmptyState from "./components/EmptyState";
import NoteCard from "./components/NoteCard";
import { dateLabel, errorText } from "./lib/format";
import type { DraftImage, Note } from "./types";

const MAX_SIZE = 10 * 1024 * 1024;
const accepted = ["image/jpeg", "image/png", "image/webp"];
const uid = () => crypto.randomUUID();
function App() {
  const [authReady, setAuthReady] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [detail, setDetail] = useState<Note | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [summary, setSummary] = useState("");
  const [draftImages, setDraftImages] = useState<DraftImage[]>([]);
  const [draftError, setDraftError] = useState("");
  const [lightbox, setLightbox] = useState<{ note: Note; index: number } | null>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const result = await api.list(); setNotes(result.notes); }
    catch (e) { setError(errorText(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    api.initialize()
      .then(() => load())
      .catch((cause) => { setError(errorText(cause)); setLoading(false); })
      .finally(() => setAuthReady(true));
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (lightbox) setLightbox(null);
        else if (deleteTarget) setDeleteTarget(null);
        else if (detail) setDetail(null);
        else if (editorOpen) closeEditor();
      }
      if (lightbox && event.key === "ArrowRight") setLightbox((v) => v ? { ...v, index: (v.index + 1) % v.note.images.length } : v);
      if (lightbox && event.key === "ArrowLeft") setLightbox((v) => v ? { ...v, index: (v.index - 1 + v.note.images.length) % v.note.images.length } : v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const visibleNotes = useMemo(() => notes.filter((note) => (note.summary || "").toLowerCase().includes(query.trim().toLowerCase())), [notes, query]);


  function openCreate() {
    setEditing(null); setSummary(""); setDraftImages([]); setDraftError(""); setEditorOpen(true);
  }
  function openEdit(note: Note) {
    setEditing(note); setSummary(note.summary || "");
    setDraftImages(note.images.map((image) => ({ kind: "existing", id: image.id, url: image.url, storage_path: image.storage_path, display_order: image.display_order })));
    setDraftError(""); setDetail(null); setEditorOpen(true);
  }
  function closeEditor(force = false) {
    if (busy && !force) return;
    if (draftImages.some((image) => image.kind === "new")) {
      draftImages.filter((image) => image.kind === "new").forEach((image) => URL.revokeObjectURL(image.url));
    }
    setEditorOpen(false); setEditing(null); setDraftImages([]); setSummary(""); setDraftError("");
  }
  function addFiles(fileList: FileList | File[] | null) {
    if (!fileList) return;
    const incoming = Array.from(fileList);
    const errors: string[] = [];
    const valid: DraftImage[] = [];
    for (const file of incoming) {
      if (!accepted.includes(file.type)) { errors.push(`${file.name}: use JPEG, PNG, or WebP.`); continue; }
      if (file.size > MAX_SIZE) { errors.push(`${file.name}: larger than 10 MB.`); continue; }
      valid.push({ kind: "new", id: uid(), url: URL.createObjectURL(file), file, display_order: draftImages.length + valid.length });
    }
    setDraftImages((current) => [...current, ...valid]);
    setDraftError(errors.join(" "));
    if (valid.length && pickerRef.current) pickerRef.current.value = "";
  }
  function removeDraft(id: string) {
    setDraftImages((current) => {
      const removed = current.find((image) => image.id === id);
      if (removed?.kind === "new") URL.revokeObjectURL(removed.url);
      return current.filter((image) => image.id !== id).map((image, index) => ({ ...image, display_order: index }));
    });
  }
  function moveDraft(index: number, offset: number) {
    setDraftImages((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.length) return current;
      const next = [...current]; [next[index], next[target]] = [next[target], next[index]];
      return next.map((image, i) => ({ ...image, display_order: i }));
    });
  }

  async function saveNote(event: React.FormEvent) {
    event.preventDefault(); setDraftError("");
    if (!draftImages.length) { setDraftError("Add at least one business card image before saving."); return; }
    setBusy(true);
    try {
      if (!editing) {
        const result = await api.create(summary, draftImages.filter((image): image is Extract<DraftImage, { kind: "new" }> => image.kind === "new").map((image) => image.file));
        setNotes((current) => [result.note, ...current]); setToast("Note saved successfully.");
      } else {
        const payload = draftImages.map((image) => image.kind === "existing" ? { existingId: image.id } : { file: image.file });
        const result = await api.update(editing.id, summary, payload);
        setNotes((current) => current.map((note) => note.id === editing.id ? result.note : note));
        setToast("Changes saved.");
      }
      closeEditor(true);
    } catch (e) { setDraftError(errorText(e)); }
    finally { setBusy(false); }
  }

  async function deleteNote() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.remove(deleteTarget.id);
      setNotes((current) => current.filter((note) => note.id !== deleteTarget.id));
      setSelectedIds((current) => current.filter((id) => id !== deleteTarget.id));
      setDeleteTarget(null); setDetail(null); setToast("Note deleted.");
    } catch (e) { setToast(errorText(e)); }
    finally { setBusy(false); }
  }

  async function downloadNotes(ids: string[]) {
    if (!ids.length || exporting) return;
    setExporting(true);
    try {
      const blob = await api.exportNotes(ids);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cardvault-${ids.length === 1 ? "note" : `${ids.length}-notes`}-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setToast(ids.length === 1 ? "Note download started." : `${ids.length} notes download started.`);
    } catch (cause) { setToast(errorText(cause)); }
    finally { setExporting(false); }
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function toggleAllVisible() {
    const visibleIds = visibleNotes.map((note) => note.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds((current) => allSelected ? current.filter((id) => !visibleIds.includes(id)) : [...new Set([...current, ...visibleIds])]);
  }

  if (!authReady) return <div className="splash"><div className="brand-mark"><Archive size={24}/></div><span>CardVault</span><div className="spinner"/></div>;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand-lockup" href="#" onClick={(e) => { e.preventDefault(); setDetail(null); }} aria-label="CardVault home">
          <div className="brand-mark"><Archive size={21}/></div><span>CardVault</span><span className="brand-dot">.</span>
        </a>
        <div className="topbar-right">
          <div className="secure-pill"><span/> Private collection</div>
          <button className="button primary top-add" onClick={openCreate}><Plus size={17}/> Add note</button>
        </div>
      </header>

      <main className="main-content">
        <section className="welcome-row">
          <div>
            <p className="eyebrow"><Sparkles size={13}/> YOUR PROFESSIONAL NETWORK</p>
            <h1>Good connections<br className="mobile-break"/> deserve to be kept.</h1>
            <p className="muted intro">Every card, every conversation, all in one thoughtful place.</p>
          </div>
          <div className="collection-count"><div className="count-icon"><Archive size={18}/></div><div><strong>{notes.length.toLocaleString()}</strong><span>{notes.length === 1 ? "saved note" : "saved notes"}</span></div></div>
        </section>

        <section className="toolbar">
          <div className="search-box"><Search size={18}/><input aria-label="Search notes" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your notes…"/>{query && <button className="clear-search" onClick={() => setQuery("")} aria-label="Clear search"><X size={15}/></button>}</div>
          <span className="sort-label"><Clock3 size={14}/> Recently updated</span>
          {visibleNotes.length > 0 && <button className="button secondary small selection-toggle" onClick={toggleAllVisible}>{visibleNotes.every((note) => selectedIds.includes(note.id)) ? <CheckSquare size={15}/> : <Square size={15}/>} {visibleNotes.every((note) => selectedIds.includes(note.id)) ? "Clear selection" : "Select all"}</button>}
          {selectedIds.length > 0 && <button className="button secondary small download-selected" disabled={exporting} onClick={() => void downloadNotes(selectedIds)}><Download size={15}/>{exporting ? "Preparing…" : `Download (${selectedIds.length})`}</button>}
          <button className="button primary desktop-add" onClick={openCreate}><Plus size={17}/> Add note</button>
        </section>

        {error ? <div className="error-panel"><CircleHelp size={21}/><div><strong>We couldn't load your collection</strong><p>{error}</p><button className="button secondary" onClick={() => void load()}>Try again</button></div></div> :
          loading ? <div className="notes-grid">{Array.from({ length: 6 }, (_, i) => <div className="skeleton-card" key={i}><div className="skeleton-image"/><div className="skeleton-line"/><div className="skeleton-line short"/></div>)}</div> :
          visibleNotes.length ? <div className="notes-grid">{visibleNotes.map((note) => <NoteCard key={note.id} note={note} selected={selectedIds.includes(note.id)} onSelect={() => toggleSelected(note.id)} onDownload={() => void downloadNotes([note.id])} onOpen={() => setDetail(note)} onEdit={() => openEdit(note)} onDelete={() => setDeleteTarget(note)}/>)}</div> :
          <EmptyState searching={Boolean(query)} onCreate={openCreate} onClear={() => setQuery("")}/>}

        <footer className="page-footer"><span>Made for the people you meet.</span><span><ShieldCheck size={14}/> Your workspace, your network</span></footer>
      </main>

      {editorOpen && <div className="overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) closeEditor(); }}>
        <section className="modal editor-modal" role="dialog" aria-modal="true" aria-labelledby="editor-title">
          <div className="modal-header"><div><p className="eyebrow">{editing ? "KEEP IT UP TO DATE" : "SAVE A NEW CONNECTION"}</p><h2 id="editor-title">{editing ? "Edit your note" : "Add to your network"}</h2></div><button className="icon-button" onClick={() => closeEditor()} aria-label="Close editor"><X size={19}/></button></div>
          <form onSubmit={saveNote}>
            <div className="form-section"><div className="section-heading"><span className="step-number">01</span><div><h3>Business card photos</h3><p>Add one or more images. Up to 10 MB each.</p></div></div>
              <div className="upload-actions">
                <button type="button" className="upload-choice" onClick={() => setCameraOpen(true)}><div className="upload-choice-icon"><ImagePlus size={19}/></div><span><strong>Take a photo</strong><small>Open live camera</small></span></button>
                <button type="button" className="upload-choice" onClick={() => pickerRef.current?.click()}><div className="upload-choice-icon"><UploadCloud size={19}/></div><span><strong>Choose photos</strong><small>From your device</small></span></button>
                <input ref={pickerRef} hidden type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => addFiles(e.target.files)}/>
              </div>
              {draftImages.length > 0 && <div className="draft-grid">{draftImages.map((image, index) => <div className="draft-image" key={image.id}><img src={image.url} alt={`Business card ${index + 1}`} /><span className="image-index">{index + 1}</span><div className="draft-controls"><button type="button" disabled={index === 0} onClick={() => moveDraft(index, -1)} title="Move earlier" aria-label="Move image earlier"><ChevronLeft size={14}/></button><button type="button" disabled={index === draftImages.length - 1} onClick={() => moveDraft(index, 1)} title="Move later" aria-label="Move image later"><ChevronRight size={14}/></button><button type="button" onClick={() => removeDraft(image.id)} title="Remove image" aria-label="Remove image"><X size={14}/></button></div></div>)}</div>}
              {draftImages.length === 0 && <div className="upload-hint"> <ImagePlus size={17}/> Your card photos will appear here</div>}
              {draftError && <p className="form-error" role="alert">{draftError}</p>}
              <p className="tiny-note"><ShieldCheck size={13}/> Stored in your private image vault. Original image quality is preserved.</p>
            </div>
            <div className="form-section summary-section"><div className="section-heading"><span className="step-number">02</span><div><h3>Add a little context <span className="optional">(optional)</span></h3><p>Where you met or what to follow up on.</p></div></div>
              <textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Met at the tech conference… interested in a partnership…" rows={3} maxLength={3000}/><div className="character-count">{summary.length}/3000</div>
            </div>
            <div className="modal-footer"><span className="required-note">* At least one photo is required</span><div className="footer-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => closeEditor()}>Cancel</button><button className="button primary" type="submit" disabled={busy}>{busy ? <><span className="button-spinner"/> Saving…</> : <><Check size={17}/> {editing ? "Save changes" : "Save note"}</>}</button></div></div>
          </form>
        </section>
      </div>}

      {cameraOpen && <CameraCapture onCapture={(file) => addFiles([file])} onClose={() => setCameraOpen(false)} />}

      {detail && <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setDetail(null); }} role="presentation"><section className="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div className="modal-header detail-header"><button className="back-button" onClick={() => setDetail(null)}><ArrowLeft size={17}/> Back to notes</button><div className="detail-actions"><button className="button secondary small" onClick={() => void downloadNotes([detail.id])} disabled={exporting}><Download size={15}/> Download</button><button className="button secondary small" onClick={() => openEdit(detail)}><Pencil size={15}/> Edit</button><button className="icon-button danger-icon" aria-label="Delete note" onClick={() => setDeleteTarget(detail)}><Trash2 size={17}/></button></div></div>
        <div className="detail-body"><div className="detail-heading"><p className="eyebrow">SAVED CONNECTION</p><h2 id="detail-title">{detail.summary?.trim() ? detail.summary.split("\n")[0].slice(0, 100) : "Business cards"}</h2><p className="muted detail-date">Last updated {dateLabel(detail.updated_at)} · {detail.images.length} {detail.images.length === 1 ? "photo" : "photos"}</p></div>
          <div className="detail-gallery">{detail.images.map((image, i) => <button key={image.id} className="detail-image" onClick={() => setLightbox({ note: detail, index: i })} aria-label={`View photo ${i + 1}`}><img src={image.url} alt={`Business card ${i + 1}`} /><span><ZoomIn size={16}/></span></button>)}</div>
          {detail.summary && <div className="detail-summary"><h3>Your note</h3><p>{detail.summary}</p></div>}
          <div className="detail-bottom"><span><Clock3 size={14}/> Created {dateLabel(detail.created_at)}</span><button className="text-button danger-text" onClick={() => setDeleteTarget(detail)}><Trash2 size={14}/> Delete this note</button></div>
        </div>
      </section></div>}

      {lightbox && <div className="lightbox" role="dialog" aria-modal="true" aria-label="Image viewer"><button className="lightbox-close" onClick={() => setLightbox(null)} aria-label="Close image viewer"><X size={23}/></button><span className="lightbox-count">{lightbox.index + 1} / {lightbox.note.images.length}</span>{lightbox.note.images.length > 1 && <button className="lightbox-arrow prev" onClick={() => setLightbox((v) => v ? { ...v, index: (v.index - 1 + v.note.images.length) % v.note.images.length } : v)} aria-label="Previous image"><ChevronLeft size={27}/></button>}<img src={lightbox.note.images[lightbox.index].url} alt={`Business card ${lightbox.index + 1}`}/>{lightbox.note.images.length > 1 && <button className="lightbox-arrow next" onClick={() => setLightbox((v) => v ? { ...v, index: (v.index + 1) % v.note.images.length } : v)} aria-label="Next image"><ChevronRight size={27}/></button>}</div>}

      {deleteTarget && <div className="overlay top-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setDeleteTarget(null); }}><section className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title"><div className="confirm-icon"><Trash2 size={21}/></div><h2 id="delete-title">Delete this note?</h2><p>This will permanently delete the note and all {deleteTarget.images.length} associated {deleteTarget.images.length === 1 ? "image" : "images"}. This can't be undone.</p><div className="confirm-actions"><button className="button secondary" disabled={busy} onClick={() => setDeleteTarget(null)}>Keep note</button><button className="button danger" disabled={busy} onClick={() => void deleteNote()}>{busy ? "Deleting…" : "Delete permanently"}</button></div></section></div>}

      {toast && <div className="toast" role="status"><Check size={17}/>{toast}</div>}
      <button className="mobile-fab" onClick={openCreate} aria-label="Add note"><Plus size={23}/></button>
    </div>
  );
}

export default App;
