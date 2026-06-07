-- Migration 000: Initial Schema for MariaDB
-- Creates vector_documentos table with MariaDB HNSW vector index
CREATE TABLE IF NOT EXISTS vector_documentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    conteudo MEDIUMTEXT NOT NULL,
    embedding VECTOR(768) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    VECTOR INDEX idx_embedding (embedding) M=8 DISTANCE=cosine
);
