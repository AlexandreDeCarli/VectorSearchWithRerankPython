-- Migration 000: Initial Schema for MySQL HeatWave (OCI Production)
-- Creates vector_documentos table without MariaDB HNSW vector index
CREATE TABLE IF NOT EXISTS vector_documentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    conteudo MEDIUMTEXT NOT NULL,
    embedding VECTOR(768) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
