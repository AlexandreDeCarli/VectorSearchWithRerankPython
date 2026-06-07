import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { DocumentForm } from './DocumentForm';
import { BatchImportModal } from './BatchImportModal';

interface DashboardProps {
  onLogout: () => void;
}

interface DocumentMeta {
  id: number;
  titulo: string;
  created_at: string;
}

interface SearchModel {
  id: string;
  name: string;
  language: string;
  type: string;
  description: string;
  is_default: boolean;
}

interface SearchResult {
  id: number;
  titulo: string;
  conteudo: string;
  similarity: number;
  rerank_score?: number;
  original_rank?: number | null;
}

interface ResultItemProps {
  res: SearchResult;
  metric: string;
  viewMode: 'compact' | 'detailed';
  onViewDetails: (doc: SearchResult) => void;
  formatScore: (score: number) => string;
  rankShift?: number | null;
}

const ResultItem: React.FC<ResultItemProps> = ({ res, metric, viewMode, onViewDetails, formatScore, rankShift }) => {
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const checkTruncation = () => {
      const el = bodyRef.current;
      if (el) {
        setIsTruncated(el.scrollHeight > el.clientHeight);
      }
    };

    checkTruncation();
    window.addEventListener('resize', checkTruncation);
    
    // Check multiple times as rendering cycles settle
    const timeoutId1 = setTimeout(checkTruncation, 50);
    const timeoutId2 = setTimeout(checkTruncation, 250);

    return () => {
      window.removeEventListener('resize', checkTruncation);
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
    };
  }, [res.conteudo, viewMode]);

  const isHigh = metric === 'COSINE'
    ? res.similarity >= 0.7
    : metric === 'EUCLIDEAN'
      ? res.similarity <= 0.4
      : res.similarity >= 0.7;

  return (
    <div className="result-item">
      <div className="result-header">
        <h4>{res.titulo}</h4>
        <div className="score-badges">
          {rankShift != null && rankShift !== 0 && (
            <span className={`rank-shift-badge ${rankShift > 0 ? 'shift-up' : 'shift-down'}`} title={`Mudança de rank: ${rankShift > 0 ? '+' : ''}${rankShift}`}>
              {rankShift > 0 ? `▲ +${rankShift}` : `▼ ${rankShift}`}
            </span>
          )}
          {rankShift === 0 && (
            <span className="rank-shift-badge shift-none" title="Sem mudança de rank">
              •
            </span>
          )}
          {res.rerank_score != null && (
            <span className="score-badge score-rerank" title="Rerank Score">
              🏆 {(res.rerank_score * 100).toFixed(1)}%
            </span>
          )}
          <span className={`score-badge ${isHigh ? 'score-high' : ''}`} title="Vector Similarity">
            {formatScore(res.similarity)}
          </span>
        </div>
      </div>
      <div className="result-body-wrapper">
        <div ref={bodyRef} className="result-body">
          {res.conteudo}
        </div>
        {isTruncated && (
          <button
            type="button"
            className="btn-show-more"
            onClick={() => onViewDetails(res)}
          >
            Ver mais
          </button>
        )}
      </div>
    </div>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [models, setModels] = useState<SearchModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [searchResults, setSearchResults] = useState<{
    original: SearchResult[];
    reranked: SearchResult[];
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [metric, setMetric] = useState<'COSINE' | 'DOT' | 'EUCLIDEAN'>('COSINE');
  const [error, setError] = useState<string | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [searching, setSearching] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState<'compact' | 'detailed'>('detailed');
  
  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [activeDocId, setActiveDocId] = useState<number | null>(null);
  const [activeDetailDoc, setActiveDetailDoc] = useState<SearchResult | null>(null);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);

  // Close modals on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveDetailDoc(null);
        setIsDeleteAllOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    loadDocuments();
    loadModels();
  }, []);

  const loadDocuments = async () => {
    setLoadingDocs(true);
    setError(null);
    try {
      const docs = await api.listDocuments();
      setDocuments(docs);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar lista de documentos');
    } finally {
      setLoadingDocs(false);
    }
  };

  const loadModels = async () => {
    if (typeof api.listSearchModels !== 'function') return;
    try {
      const availableModels = await api.listSearchModels();
      setModels(availableModels);
      const defaultModel = availableModels.find((m: SearchModel) => m.is_default);
      if (defaultModel) {
        setSelectedModel(defaultModel.id);
      } else if (availableModels.length > 0) {
        setSelectedModel(availableModels[0].id);
      }
    } catch (err: any) {
      console.error('Erro ao carregar modelos de rerank:', err);
    }
  };

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`Deseja realmente excluir o documento "${title}"?`)) return;
    setError(null);
    try {
      await api.deleteDocument(id);
      loadDocuments();
      // Remove from search results if present
      setSearchResults(prev => {
        if (!prev) return null;
        return {
          original: prev.original.filter(res => res.id !== id),
          reranked: prev.reranked.filter(res => res.id !== id),
        };
      });
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir documento');
    }
  };

  const handleDeleteAllConfirm = async () => {
    setIsDeleteAllOpen(false);
    setError(null);
    try {
      await api.deleteAllDocuments();
      loadDocuments();
      setSearchResults(null); // Clear search results as well
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir todos os documentos');
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    setError(null);
    try {
      const data = await api.search(searchQuery, metric, selectedModel || undefined);
      if (Array.isArray(data)) {
        setSearchResults({
          original: data,
          reranked: data
        });
      } else {
        setSearchResults(data);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao buscar vetores');
    } finally {
      setSearching(false);
    }
  };

  const handleOpenCreateForm = () => {
    setActiveDocId(null);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (id: number) => {
    setActiveDocId(id);
    setIsFormOpen(true);
  };

  const handleSaveSuccess = () => {
    setIsFormOpen(false);
    loadDocuments();
  };

  const formatScore = (similarity: number) => {
    if (metric === 'COSINE') {
      const percentage = Math.max(0, Math.min(100, similarity * 100));
      return `${percentage.toFixed(1)}%`;
    }
    if (metric === 'EUCLIDEAN') {
      return `d = ${similarity.toFixed(4)}`;
    }
    return `score = ${similarity.toFixed(4)}`;
  };

  return (
    <div className="dashboard-layout">
      <header className="app-header">
        <div className="header-container">
          <h1>VectorSearch + Rerank</h1>
          <div className="user-controls">
            <span className="user-badge">Logado como Admin</span>
            <button className="btn btn-secondary" onClick={onLogout}>Sair da Conta</button>
          </div>
        </div>
      </header>

      <div className={`dashboard-body ${isSidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
        {/* Left Sidebar: Document List */}
        <aside className="sidebar-panel">
          <div className="sidebar-header">
            <h2>Documentos Salvos ({documents.length})</h2>
            <div className="doc-actions">
              {documents.length > 0 && (
                <button className="btn btn-danger btn-icon" onClick={() => setIsDeleteAllOpen(true)} title="Excluir Todos os Documentos">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              )}
              <button className="btn btn-secondary btn-icon" onClick={() => setIsBatchOpen(true)} title="Importar Lote (JSON)">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </button>
              <button className="btn btn-primary btn-icon" onClick={handleOpenCreateForm} title="Inserir Documento">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
            </div>
          </div>

          <div className="sidebar-content">
            {error && <div className="alert alert-danger">{error}</div>}

            {loadingDocs ? (
              <div className="loading-container">Carregando...</div>
            ) : documents.length === 0 ? (
              <div className="empty-state">
                <p>Nenhum documento cadastrado.</p>
                <p className="empty-state-subtitle">
                  Insira o primeiro texto para gerar seu embedding.
                </p>
              </div>
            ) : (
              <div className="document-list">
                {documents.map((doc) => (
                  <div key={doc.id} className="glass-card document-item" title={doc.titulo}>
                    <div className="doc-info">
                      <h3>{doc.titulo}</h3>
                      <div className="doc-meta">
                        {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                    <div className="doc-actions">
                      <button className="btn btn-secondary btn-icon" title="Editar Documento" onClick={() => handleOpenEditForm(doc.id)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button className="btn btn-danger btn-icon" title="Excluir Documento" onClick={() => handleDelete(doc.id, doc.titulo)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Right / Main Panel: Vector Search */}
        <main className="search-main-panel">
          <div className="search-container-inner">
            <div className="search-panel-header">
              <button 
                type="button" 
                className="btn sidebar-toggle-btn"
                onClick={() => setIsSidebarOpen(prev => !prev)}
                title={isSidebarOpen ? "Recolher Documentos" : "Mostrar Documentos"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {isSidebarOpen ? (
                    <>
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </>
                  ) : (
                    <>
                      <line x1="3" y1="12" x2="21" y2="12"></line>
                      <line x1="3" y1="6" x2="21" y2="6"></line>
                      <line x1="3" y1="18" x2="21" y2="18"></line>
                    </>
                  )}
                </svg>
                <span>{isSidebarOpen ? "Esconder Documentos" : "Ver Documentos Salvos"}</span>
              </button>
              <h2>Busca por Semelhança (Vetores)</h2>
            </div>

            <div className="glass-card search-panel">
              {/* Controls Row */}
              <div className="search-controls-row">
                {/* Vector Metric Selector controls */}
                <div className="metric-selector-group">
                  <span className="metric-selector-label">Métrica de Distância Vetorial</span>
                  <div className="metric-options">
                    <button
                      type="button"
                      className={`btn metric-option-btn ${metric === 'COSINE' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setMetric('COSINE')}
                      disabled={searching}
                    >
                      Cosseno
                    </button>
                    <button
                      type="button"
                      className={`btn metric-option-btn ${metric === 'DOT' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setMetric('DOT')}
                      disabled={searching}
                    >
                      Produto Escalar
                    </button>
                    <button
                      type="button"
                      className={`btn metric-option-btn ${metric === 'EUCLIDEAN' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setMetric('EUCLIDEAN')}
                      disabled={searching}
                    >
                      Euclidiana
                    </button>
                  </div>
                  <p className="metric-description">
                    {metric === 'COSINE' && '🔍 COSSENO: Busca semântica e embeddings de texto normalizados (1 - distância).'}
                    {metric === 'DOT' && '⚡ PRODUTO ESCALAR: Produto escalar direto para embeddings não normalizados.'}
                    {metric === 'EUCLIDEAN' && '📐 EUCLIDIANA: Distância geométrica direta entre vetores (menor distância é melhor).'}
                  </p>
                </div>

                {/* Model Selector controls */}
                <div className="model-selector-group">
                  <span className="model-selector-label">Modelo de Re-ranqueamento (Fase 2)</span>
                  <select
                    className="model-select-control"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={searching || models.length === 0}
                  >
                    {models.length === 0 ? (
                      <option value="">Carregando modelos...</option>
                    ) : (
                      models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} {m.is_default ? ' (Padrão)' : ''}
                        </option>
                      ))
                    )}
                  </select>
                  <p className="model-description">
                    {(() => {
                      const m = models.find((x) => x.id === selectedModel);
                      return m ? `🧠 ${m.type} (${m.language}): ${m.description}` : 'Selecione um modelo de reranking.';
                    })()}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSearchSubmit} className="search-box">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Pesquise conceitos, temas, significados..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  required
                  disabled={searching}
                />
                <button type="submit" className="btn btn-primary" disabled={searching}>
                  {searching ? (
                    <span className="loading-spinner"></span>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', display: 'inline-block', verticalAlign: 'middle' }}>
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                      </svg>
                      <span>Buscar</span>
                    </>
                  )}
                </button>
              </form>

              <div className="search-results-container">
                {/* Onboarding Empty State */}
                {!searchResults && !searching && (
                  <div className="search-empty-state">
                    <div className="empty-state-icon">🔍</div>
                    <h3>Pronto para Pesquisar</h3>
                    <p>Digite um termo e selecione o modelo para comparar a busca vetorial bruta contra o re-ranqueamento em tempo real.</p>
                  </div>
                )}

                {searchResults && (searchResults.original.length > 0 || searchResults.reranked.length > 0) && (
                  <div className={`results-comparison-layout ${viewMode === 'compact' ? 'results-list-compact' : 'results-list-detailed'} ${searching ? 'loading-results' : ''}`}>
                    <div className="results-header-row">
                      <div className="doc-meta results-meta">
                        {metric === 'COSINE' && 'Métrica: Cosseno'}
                        {metric === 'DOT' && 'Métrica: Produto Escalar'}
                        {metric === 'EUCLIDEAN' && 'Métrica: Distância Euclidiana'}
                        {searchResults.reranked.length > 0 && ` | Rerank: ${models.find(x => x.id === selectedModel)?.name || selectedModel}`}
                      </div>
                      <div className="view-mode-selector">
                        <button
                          type="button"
                          className={`view-mode-btn ${viewMode === 'compact' ? 'active' : ''}`}
                          onClick={() => setViewMode('compact')}
                          title="Visualização Resumida"
                        >
                          Resumido
                        </button>
                        <button
                          type="button"
                          className={`view-mode-btn ${viewMode === 'detailed' ? 'active' : ''}`}
                          onClick={() => setViewMode('detailed')}
                          title="Visualização Detalhada"
                        >
                          Detalhado
                        </button>
                      </div>
                    </div>

                    <div className="results-comparison-grid">
                      {/* Left Column: Original Results */}
                      <div className="results-column original-column">
                        <div className="results-column-title">
                          <span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', display: 'inline-block', verticalAlign: 'middle', opacity: 0.8 }}>
                              <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                              <path d="M3 5V19A9 3 0 0 0 21 19V5"></path>
                              <path d="M3 12A9 3 0 0 0 21 12"></path>
                            </svg>
                            Recall Original (Sem Rerank)
                          </span>
                          <span className="results-count-badge">{searchResults.original.length} docs</span>
                        </div>
                        <div className="results-list">
                          {searchResults.original.map((res) => (
                            <ResultItem
                              key={`orig-${res.id}`}
                              res={res}
                              metric={metric}
                              viewMode={viewMode}
                              onViewDetails={setActiveDetailDoc}
                              formatScore={formatScore}
                            />
                          ))}
                          {searchResults.original.length === 0 && (
                            <div className="no-results">Nenhum resultado retornado.</div>
                          )}
                        </div>
                      </div>

                      {/* Right Column: Reranked Results */}
                      <div className="results-column reranked-column">
                        <div className="results-column-title">
                          <span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', display: 'inline-block', verticalAlign: 'middle', opacity: 0.8 }}>
                              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
                              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
                              <path d="M4 22h16"></path>
                              <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34"></path>
                              <path d="M12 2a5 5 0 0 0-5 5v3c0 2.2 1.8 4 4 4h2c2.2 0 4-1.8 4-4V7a5 5 0 0 0-5-5z"></path>
                            </svg>
                            Reordenado (Com Rerank)
                          </span>
                          <span className="results-count-badge">{searchResults.reranked.length} docs</span>
                        </div>
                        <div className="results-list">
                          {searchResults.reranked.map((res, newIndex) => {
                            const shift = res.original_rank !== undefined && res.original_rank !== null
                              ? res.original_rank - newIndex
                              : (() => {
                                  const origIndex = searchResults.original.findIndex(x => x.id === res.id);
                                  return origIndex !== -1 ? origIndex - newIndex : null;
                                })();

                            return (
                              <ResultItem
                                key={`rerank-${res.id}`}
                                res={res}
                                metric={metric}
                                viewMode={viewMode}
                                onViewDetails={setActiveDetailDoc}
                                formatScore={formatScore}
                                rankShift={shift}
                              />
                            );
                          })}
                          {searchResults.reranked.length === 0 && (
                            <div className="no-results">Nenhum resultado retornado.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {searchResults && searchResults.original.length === 0 && searchResults.reranked.length === 0 && searchQuery && !searching && (
                  <div className="no-results">
                    Nenhum resultado retornado para a busca.
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Document Create/Edit Modal */}
      {isFormOpen && (
        <DocumentForm
          documentId={activeDocId}
          onClose={() => setIsFormOpen(false)}
          onSave={handleSaveSuccess}
        />
      )}

      {/* Batch Import Modal */}
      {isBatchOpen && (
        <BatchImportModal
          onClose={() => setIsBatchOpen(false)}
          onSave={handleSaveSuccess}
        />
      )}

      {/* Document Detail/Preview Modal */}
      {activeDetailDoc && (
        <div className="modal-overlay" onClick={() => setActiveDetailDoc(null)}>
          <div className="glass-card modal-content" style={{ maxWidth: '700px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{activeDetailDoc.titulo}</h2>
              <button className="modal-close" onClick={() => setActiveDetailDoc(null)}>&times;</button>
            </div>
            <div className="doc-preview-body">
              {activeDetailDoc.conteudo}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setActiveDetailDoc(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Confirmation Modal */}
      {isDeleteAllOpen && (
        <div className="modal-overlay" onClick={() => setIsDeleteAllOpen(false)}>
          <div className="glass-card modal-content" style={{ maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ color: 'var(--danger)' }}>Confirmar Exclusão Total</h2>
              <button className="modal-close" onClick={() => setIsDeleteAllOpen(false)}>&times;</button>
            </div>
            <div style={{ margin: '15px 0', fontSize: '0.95rem', lineHeight: '1.5', color: 'var(--text-primary)' }}>
              <p style={{ marginBottom: '10px' }}>
                Você está prestes a excluir **todos os {documents.length} documentos** cadastrados no sistema.
              </p>
              <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                ⚠️ Esta ação limpará completamente a base de dados de vetores e é irreversível. Deseja continuar?
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsDeleteAllOpen(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteAllConfirm}
              >
                Sim, Excluir Tudo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
