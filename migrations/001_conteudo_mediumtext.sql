-- Migration 001: Expand conteudo column from TEXT (64KB) to MEDIUMTEXT (16MB)
-- Supports large documents like PDFs, manuals, and long markdown files
ALTER TABLE vector_documentos MODIFY conteudo MEDIUMTEXT NOT NULL;
