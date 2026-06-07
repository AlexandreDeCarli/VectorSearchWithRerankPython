import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

interface BatchImportModalProps {
  onClose: () => void;
  onSave: () => void;
}

interface ParsedDoc {
  nome: string;
  conteudo: string; // base64
}

interface LogLine {
  text: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface FailureDetail {
  nome: string;
  error: string;
}

export const BatchImportModal: React.FC<BatchImportModalProps> = ({ onClose, onSave }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedDocs, setParsedDocs] = useState<ParsedDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  
  const [stats, setStats] = useState({ created: 0, updated: 0, skipped: 0, failed: 0 });
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [failures, setFailures] = useState<FailureDetail[]>([]);

  // Auto-scroll the terminal log when logs change
  useEffect(() => {
    const logBox = document.getElementById('import-terminal-log');
    if (logBox) {
      logBox.scrollTop = logBox.scrollHeight;
    }
  }, [logs]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setError(null);
    setParsedDocs(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const json = JSON.parse(text);

        if (!Array.isArray(json)) {
          throw new Error('O arquivo JSON deve conter uma lista/array na raiz.');
        }

        const validDocs = json.every(
          (item) =>
            typeof item === 'object' &&
            item !== null &&
            typeof item.nome === 'string' &&
            typeof item.conteudo === 'string'
        );

        if (!validDocs) {
          throw new Error('Cada item da lista deve possuir as propriedades "nome" (string) e "conteudo" (string em base64).');
        }

        setParsedDocs(json);
      } catch (err: any) {
        setError(err.message || 'Erro ao decodificar o arquivo JSON.');
        setSelectedFile(null);
        setParsedDocs(null);
      }
    };
    reader.onerror = () => {
      setError('Erro ao ler o arquivo selecionado.');
      setSelectedFile(null);
      setParsedDocs(null);
    };
    reader.readAsText(file);
  };

  const startImport = async () => {
    if (!parsedDocs || parsedDocs.length === 0) return;

    setImporting(true);
    setIsFinished(false);
    setStats({ created: 0, updated: 0, skipped: 0, failed: 0 });
    setLogs([{ text: `[START] Iniciando a importação de ${parsedDocs.length} documentos...`, type: 'info' }]);
    setFailures([]);

    const newStats = { created: 0, updated: 0, skipped: 0, failed: 0 };
    const newFailures: FailureDetail[] = [];

    for (let i = 0; i < parsedDocs.length; i++) {
      setCurrentIndex(i);
      const doc = parsedDocs[i];

      setLogs((prev) => [
        ...prev,
        { text: `[${i + 1}/${parsedDocs.length}] Processando "${doc.nome}"...`, type: 'info' },
      ]);

      try {
        const res = await api.importDocument(doc.nome, doc.conteudo);

        if (res.action === 'created') {
          newStats.created++;
          setLogs((prev) => [
            ...prev,
            { text: ` -> Sucesso: Criado no banco de dados.`, type: 'success' },
          ]);
        } else if (res.action === 'updated') {
          newStats.updated++;
          setLogs((prev) => [
            ...prev,
            { text: ` -> Sucesso: Conteúdo atualizado no banco (novo embedding gerado).`, type: 'success' },
          ]);
        } else if (res.action === 'skipped') {
          newStats.skipped++;
          setLogs((prev) => [
            ...prev,
            { text: ` -> Pulado: Conteúdo idêntico já cadastrado (embedding preservado).`, type: 'warning' },
          ]);
        }

        setStats({ ...newStats });
      } catch (err: any) {
        newStats.failed++;
        const errMsg = err.message || 'Erro de comunicação com o servidor';
        newFailures.push({ nome: doc.nome, error: errMsg });

        setLogs((prev) => [
          ...prev,
          { text: ` -> Falha: ${errMsg}`, type: 'error' },
        ]);
        setStats({ ...newStats });
        setFailures([...newFailures]);
      }
    }

    setLogs((prev) => [
      ...prev,
      { text: `[FINISH] Lote processado. Sucesso: ${newStats.created + newStats.updated + newStats.skipped}, Falhas: ${newStats.failed}.`, type: 'info' },
    ]);
    setImporting(false);
    setIsFinished(true);
  };

  const progressPercent = parsedDocs && parsedDocs.length > 0
    ? Math.round(((isFinished ? currentIndex + 1 : currentIndex) / parsedDocs.length) * 100)
    : 0;

  return (
    <div className="modal-overlay">
      <div className="glass-card modal-content" style={{ maxWidth: '750px' }}>
        <div className="modal-header">
          <h2>Importar Lote de Documentos (JSON)</h2>
          <button className="modal-close" onClick={onClose} disabled={importing}>&times;</button>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        {!importing && !isFinished ? (
          <div>
            <div className="file-dropzone" onClick={() => document.getElementById('jsonFileInput')?.click()}>
              <input
                type="file"
                id="jsonFileInput"
                style={{ display: 'none' }}
                accept=".json"
                onChange={handleFileChange}
              />
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="dropzone-icon" style={{ display: 'inline-block', margin: '0 auto 10px auto' }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              {selectedFile ? (
                <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Arquivo selecionado: {selectedFile.name}</p>
              ) : (
                <p>Arraste ou clique para fazer upload do arquivo JSON de lote</p>
              )}
            </div>

            {parsedDocs && (
              <div style={{ marginBottom: '20px' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                  O arquivo contém <strong>{parsedDocs.length}</strong> documentos válidos estruturados.
                </p>
                <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '10px 15px' }}>
                  <ul style={{ listStyle: 'none', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {parsedDocs.map((doc, idx) => (
                      <li key={idx} style={{ marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        [{idx + 1}] {doc.nome} ({Math.round(doc.conteudo.length * 0.75 / 1024 * 10) / 10} KB)
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={startImport}
                disabled={!parsedDocs || parsedDocs.length === 0}
              >
                Confirmar Importação
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="import-progress-container">
              <div className="import-progress-info">
                <span>
                  {importing ? `Processando ${currentIndex + 1} de ${parsedDocs?.length}...` : 'Importação concluída!'}
                </span>
                <span>{progressPercent}%</span>
              </div>
              <div className="import-progress-bar">
                <div className="import-progress-fill" style={{ width: `${progressPercent}%` }}></div>
              </div>

              {/* Progress Summary Cards */}
              <div className="import-summary-grid">
                <div className="import-summary-card created">
                  <h4>Criados</h4>
                  <div className="stat-val">{stats.created}</div>
                </div>
                <div className="import-summary-card updated">
                  <h4>Atualizados</h4>
                  <div className="stat-val">{stats.updated}</div>
                </div>
                <div className="import-summary-card skipped">
                  <h4>Pulados</h4>
                  <div className="stat-val">{stats.skipped}</div>
                </div>
                <div className="import-summary-card failed">
                  <h4>Falhas</h4>
                  <div className="stat-val">{stats.failed}</div>
                </div>
              </div>

              {/* Terminal Logging box */}
              <div className="import-terminal-log" id="import-terminal-log">
                {logs.map((log, idx) => (
                  <div key={idx} className={`import-terminal-line ${log.type}`}>
                    {log.text}
                  </div>
                ))}
              </div>
            </div>

            {/* Error Detail Logs */}
            {isFinished && failures.length > 0 && (
              <div className="import-failed-section">
                <h3>Detalhes das Falhas ({failures.length})</h3>
                <div className="import-failed-list">
                  {failures.map((fail, idx) => (
                    <div key={idx} className="import-failed-item">
                      <span style={{ fontWeight: 600 }}>{fail.nome}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{fail.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  onSave();
                  onClose();
                }}
                disabled={importing}
              >
                Concluir
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
