#!/usr/bin/env python3
"""
FDIS Local Content Library — PDF Ingestion Script
Parses a PDF book into searchable JSON chunks for the knowledge engine.

Usage:
    python3 ingest-pdf.py path/to/book.pdf
    python3 ingest-pdf.py path/to/book.pdf --chapter-size 30  # pages per chunk
    python3 ingest-pdf.py path/to/book.pdf --name "Custom Book Name"

Output:
    local-content-library/content/entries/<book-id>-section-N.json
    local-content-library/content/manifest.json (updated)
"""

import sys
import os
import json
import re
import argparse
from datetime import datetime, timezone
from pathlib import Path

# ── Dependency check ──────────────────────────────────────────────────────────

def ensure_pdfplumber():
    try:
        import pdfplumber
        return pdfplumber
    except ImportError:
        print("Installing pdfplumber...")
        os.system(f"{sys.executable} -m pip install pdfplumber --break-system-packages -q")
        try:
            import pdfplumber
            return pdfplumber
        except ImportError:
            print("ERROR: Could not install pdfplumber. Try: pip install pdfplumber")
            sys.exit(1)

# ── Text chunking ─────────────────────────────────────────────────────────────

def chunk_text(text: str, max_chars: int = 2000) -> list[str]:
    paragraphs = text.split('\n\n')
    chunks, current, current_len = [], [], 0
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        if current_len + len(para) > max_chars and current:
            chunks.append('\n\n'.join(current))
            current, current_len = [para], len(para)
        else:
            current.append(para)
            current_len += len(para)
    if current:
        chunks.append('\n\n'.join(current))
    return [c for c in chunks if c.strip()]

# ── Clean extracted text ──────────────────────────────────────────────────────

def clean_text(text: str, book_name: str) -> str:
    # Remove book header/footer repetitions
    text = re.sub(re.escape(book_name) + r'\s*\d*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

# ── TOC detection ─────────────────────────────────────────────────────────────

def detect_chapters_from_toc(pages: list) -> list[dict]:
    """Try to detect chapter boundaries from early pages (TOC heuristic)."""
    toc_entries = []
    for page in pages[:5]:
        text = page.extract_text() or ''
        matches = re.findall(r'(Chapter\s+\d+[.:]\s+[^\n]+)\s+(\d+)', text, re.IGNORECASE)
        for title, page_num in matches:
            toc_entries.append({'title': title.strip(), 'page': int(page_num)})
    return toc_entries

# ── Main ingestion ────────────────────────────────────────────────────────────

def ingest_pdf(pdf_path: str, chapter_size: int = 20, book_name_override: str = None):
    pdfplumber = ensure_pdfplumber()

    if not os.path.exists(pdf_path):
        print(f"ERROR: File not found: {pdf_path}")
        sys.exit(1)

    filename = os.path.basename(pdf_path)
    book_name = book_name_override or Path(filename).stem.replace('_', ' ').replace('-', ' ')
    book_id = re.sub(r'[^a-z0-9]', '-', book_name.lower())[:40].strip('-')

    # Find the script's directory → project root
    script_dir = Path(__file__).parent
    entries_dir = script_dir.parent / 'content' / 'entries'
    manifest_path = script_dir.parent / 'content' / 'manifest.json'
    entries_dir.mkdir(parents=True, exist_ok=True)

    ingested_at = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')

    print(f"📖 Ingesting: {filename}")
    print(f"   Book name: {book_name}")
    print(f"   Output ID: {book_id}")

    entries = []

    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        print(f"   Pages: {total_pages}")

        # Try chapter-aware splitting
        toc = detect_chapters_from_toc(pdf.pages)
        if len(toc) >= 3:
            print(f"   TOC detected: {len(toc)} chapters")
            # Build page ranges from TOC
            sections = []
            for i, entry in enumerate(toc):
                start = entry['page'] - 1  # 0-indexed
                end = toc[i + 1]['page'] - 2 if i + 1 < len(toc) else total_pages - 1
                sections.append({
                    'title': entry['title'],
                    'start': max(0, start),
                    'end': min(end, total_pages - 1),
                })
        else:
            # Fall back to fixed-size page grouping
            sections = []
            for start in range(0, total_pages, chapter_size):
                end = min(start + chapter_size - 1, total_pages - 1)
                n = len(sections) + 1
                sections.append({
                    'title': f'Pages {start + 1}–{end + 1}',
                    'start': start,
                    'end': end,
                })

        for i, section in enumerate(sections):
            section_num = i + 1
            page_texts = []
            for page_idx in range(section['start'], section['end'] + 1):
                text = pdf.pages[page_idx].extract_text()
                if text:
                    page_texts.append(clean_text(text, book_name))

            full_text = '\n\n'.join(page_texts)
            if not full_text.strip():
                continue

            text_chunks = chunk_text(full_text)
            entry_id = f"{book_id}-section-{section_num:02d}"

            chunk_objects = [
                {
                    "id": f"{entry_id}-chunk-{idx:03d}",
                    "text": chunk,
                    "metadata": {
                        "section": section['title'],
                        "chunkIndex": idx,
                        "pageRange": f"{section['start'] + 1}-{section['end'] + 1}",
                    }
                }
                for idx, chunk in enumerate(text_chunks)
            ]

            entry = {
                "id": entry_id,
                "title": f"{book_name} — {section['title']}",
                "source": {
                    "type": "pdf",
                    "location": filename,
                    "ingested_at": ingested_at,
                },
                "content": full_text[:500] + ("..." if len(full_text) > 500 else ""),
                "chunks": chunk_objects,
                "metadata": {
                    "category": "architecture",
                    "tags": ["book", "design-systems"],
                    "confidence": "high",
                    "system": book_name,
                    "last_updated": ingested_at,
                }
            }
            entries.append(entry)

            out_path = entries_dir / f"{entry_id}.json"
            with open(out_path, 'w', encoding='utf-8') as f:
                json.dump(entry, f, indent=2, ensure_ascii=False)

            total_chunks = len(chunk_objects)
            print(f"   ✓ Section {section_num:02d}: {section['title']} → {total_chunks} chunks")

    # ── Update manifest ────────────────────────────────────────────────────────

    if manifest_path.exists():
        with open(manifest_path, 'r') as f:
            manifest = json.load(f)
    else:
        manifest = {"version": "1.0.0", "sources": [], "entries": [], "total_entries": 0}

    # Remove any previous entries for this book_id
    manifest["entries"] = [e for e in manifest.get("entries", []) if not e.startswith(book_id)]
    manifest["sources"] = [s for s in manifest.get("sources", []) if s.get("id") != book_id]

    new_entry_files = [f"{e['id']}.json" for e in entries]
    manifest["entries"].extend(new_entry_files)
    manifest["total_entries"] = len(manifest["entries"])
    manifest["generated_at"] = ingested_at
    manifest["sources"].append({
        "id": book_id,
        "name": book_name,
        "type": "pdf",
        "file": filename,
        "sections": len(entries),
        "totalChunks": sum(len(e["chunks"]) for e in entries),
        "ingested_at": ingested_at,
    })

    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)

    total_chunks_all = sum(len(e["chunks"]) for e in entries)
    print(f"\n✅ Done!")
    print(f"   Sections: {len(entries)}")
    print(f"   Chunks:   {total_chunks_all}")
    print(f"   Files:    {entries_dir}")
    print(f"\nNow searchable via: lookup_design_guidance tool in FDIS")


# ── CLI ────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Ingest a PDF book into the FDIS local knowledge base",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 ingest-pdf.py Designsystemshandbook.pdf
  python3 ingest-pdf.py atomic-design.pdf --name "Atomic Design by Brad Frost"
  python3 ingest-pdf.py large-book.pdf --chapter-size 15
        """
    )
    parser.add_argument("pdf_path", help="Path to the PDF file to ingest")
    parser.add_argument("--chapter-size", type=int, default=20, help="Pages per section when no TOC detected (default: 20)")
    parser.add_argument("--name", type=str, default=None, help="Override the book/document name")
    args = parser.parse_args()

    ingest_pdf(args.pdf_path, chapter_size=args.chapter_size, book_name_override=args.name)
