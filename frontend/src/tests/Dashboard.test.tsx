import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { Dashboard } from '../components/Dashboard';
import { api } from '../utils/api';

// Mock the API module
vi.mock('../utils/api', () => ({
  api: {
    listDocuments: vi.fn(),
    deleteDocument: vi.fn(),
    deleteAllDocuments: vi.fn(),
    search: vi.fn(),
  },
}));

// Mock the DocumentForm subcomponent to avoid loading dependencies
vi.mock('../components/DocumentForm', () => ({
  DocumentForm: ({ documentId, onClose, onSave }: any) => (
    <div data-testid="mock-document-form">
      <span>Mock Form {documentId}</span>
      <button onClick={onSave}>Save mock</button>
      <button onClick={onClose}>Close mock</button>
    </div>
  ),
}));

describe('Dashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render headers and title sections', async () => {
    (api.listDocuments as any).mockResolvedValue([]);
    
    render(<Dashboard onLogout={() => {}} />);
    
    expect(screen.getByText('VectorScore')).toBeInTheDocument();
    expect(screen.getByText('Logado como Admin')).toBeInTheDocument();
    expect(screen.getByText('Busca por Semelhança (Vetores)')).toBeInTheDocument();
  });

  it('should render empty state when no documents exist', async () => {
    (api.listDocuments as any).mockResolvedValue([]);

    render(<Dashboard onLogout={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Nenhum documento cadastrado.')).toBeInTheDocument();
    });
  });

  it('should render document list when documents exist', async () => {
    (api.listDocuments as any).mockResolvedValue([
      { id: 1, titulo: 'Primeiro Documento', created_at: '2026-06-05T12:00:00Z' },
      { id: 2, titulo: 'Segundo Documento', created_at: '2026-06-05T13:00:00Z' },
    ]);

    render(<Dashboard onLogout={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Primeiro Documento')).toBeInTheDocument();
      expect(screen.getByText('Segundo Documento')).toBeInTheDocument();
    });
  });

  it('should call api.search and render results on search submit with COSINE', async () => {
    (api.listDocuments as any).mockResolvedValue([]);
    (api.search as any).mockResolvedValue([
      { id: 1, titulo: 'Resultado da Busca 1', conteudo: 'Exemplo de texto 1', similarity: 0.852 }
    ]);

    render(<Dashboard onLogout={() => {}} />);

    const searchInput = screen.getByPlaceholderText(/Pesquise conceitos/i);
    const searchBtn = screen.getByRole('button', { name: /Buscar/i });

    fireEvent.change(searchInput, { target: { value: 'inteligência artificial' } });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(api.search).toHaveBeenCalledWith('inteligência artificial', 'COSINE');
      expect(screen.getByText('Resultado da Busca 1')).toBeInTheDocument();
      expect(screen.getByText('Exemplo de texto 1')).toBeInTheDocument();
      expect(screen.getByText('85.2%')).toBeInTheDocument();
    });
  });

  it('should call api.search with DOT and render raw score formatting', async () => {
    (api.listDocuments as any).mockResolvedValue([]);
    (api.search as any).mockResolvedValue([
      { id: 1, titulo: 'Resultado DOT', conteudo: 'Exemplo DOT', similarity: 1.23456 }
    ]);

    render(<Dashboard onLogout={() => {}} />);

    // Select Produto Escalar
    const dotBtn = screen.getByRole('button', { name: /Produto Escalar/i });
    fireEvent.click(dotBtn);

    expect(screen.getByText(/⚡ PRODUTO ESCALAR:/)).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/Pesquise conceitos/i);
    const searchBtn = screen.getByRole('button', { name: /Buscar/i });

    fireEvent.change(searchInput, { target: { value: 'outro termo' } });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(api.search).toHaveBeenCalledWith('outro termo', 'DOT');
      expect(screen.getByText('Resultado DOT')).toBeInTheDocument();
      expect(screen.getByText('score = 1.2346')).toBeInTheDocument();
    });
  });

  it('should call api.search with EUCLIDEAN and render distance formatting', async () => {
    (api.listDocuments as any).mockResolvedValue([]);
    (api.search as any).mockResolvedValue([
      { id: 1, titulo: 'Resultado EUCLIDEAN', conteudo: 'Exemplo EUCLIDEAN', similarity: 0.35 }
    ]);

    render(<Dashboard onLogout={() => {}} />);

    // Select Euclidiana
    const euclideanBtn = screen.getByRole('button', { name: /Euclidiana/i });
    fireEvent.click(euclideanBtn);

    expect(screen.getByText(/📐 EUCLIDIANA:/)).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/Pesquise conceitos/i);
    const searchBtn = screen.getByRole('button', { name: /Buscar/i });

    fireEvent.change(searchInput, { target: { value: 'outro termo 2' } });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(api.search).toHaveBeenCalledWith('outro termo 2', 'EUCLIDEAN');
      expect(screen.getByText('Resultado EUCLIDEAN')).toBeInTheDocument();
      expect(screen.getByText('d = 0.3500')).toBeInTheDocument();
    });
  });

  it('should open create modal when clicking new document', async () => {
    (api.listDocuments as any).mockResolvedValue([]);

    render(<Dashboard onLogout={() => {}} />);

    const newBtn = screen.getByTitle('Inserir Documento');
    fireEvent.click(newBtn);

    expect(screen.getByTestId('mock-document-form')).toBeInTheDocument();
  });

  it('should toggle sidebar layout when clicking the toggle button', async () => {
    (api.listDocuments as any).mockResolvedValue([]);

    const { container } = render(<Dashboard onLogout={() => {}} />);

    // Initially open
    expect(container.querySelector('.sidebar-open')).toBeInTheDocument();
    expect(container.querySelector('.sidebar-collapsed')).not.toBeInTheDocument();

    const toggleBtn = screen.getByRole('button', { name: /Esconder Documentos/i });
    fireEvent.click(toggleBtn);

    // Now collapsed
    expect(container.querySelector('.sidebar-collapsed')).toBeInTheDocument();
    expect(container.querySelector('.sidebar-open')).not.toBeInTheDocument();

    // Text changed
    expect(screen.getByText('Ver Documentos Salvos')).toBeInTheDocument();
  });

  it('should toggle view mode between detailed and compact', async () => {
    (api.listDocuments as any).mockResolvedValue([]);
    (api.search as any).mockResolvedValue([
      { id: 1, titulo: 'Documento Teste', conteudo: 'Conteudo do documento detalhado', similarity: 0.9 }
    ]);

    const { container } = render(<Dashboard onLogout={() => {}} />);

    // Perform search to render results list
    const searchInput = screen.getByPlaceholderText(/Pesquise conceitos/i);
    const searchBtn = screen.getByRole('button', { name: /Buscar/i });
    fireEvent.change(searchInput, { target: { value: 'teste' } });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(screen.getByText('Documento Teste')).toBeInTheDocument();
      expect(screen.getByText('Conteudo do documento detalhado')).toBeInTheDocument();
    });

    // Toggle to Compact
    const compactBtn = screen.getByRole('button', { name: /Resumido/i });
    fireEvent.click(compactBtn);

    // Verify it is compact (parent has compact class)
    expect(container.querySelector('.results-list-compact')).toBeInTheDocument();
    expect(container.querySelector('.results-list-detailed')).not.toBeInTheDocument();

    // Toggle back to Detailed
    const detailedBtn = screen.getByRole('button', { name: /Detalhado/i });
    fireEvent.click(detailedBtn);

    expect(container.querySelector('.results-list-compact')).not.toBeInTheDocument();
    expect(container.querySelector('.results-list-detailed')).toBeInTheDocument();
  });

  it('should render "Ver mais" button when content is truncated and open detail modal on click', async () => {
    (api.listDocuments as any).mockResolvedValue([]);
    (api.search as any).mockResolvedValue([
      { id: 1, titulo: 'Documento Muito Longo', conteudo: 'Linha 1\nLinha 2\nLinha 3\nLinha 4\nLinha 5', similarity: 0.9 }
    ]);

    // Mock scrollHeight and clientHeight to simulate truncation (scrollHeight > clientHeight)
    const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
    const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');

    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 100 });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 50 });

    const { container } = render(<Dashboard onLogout={() => {}} />);

    // Perform search
    const searchInput = screen.getByPlaceholderText(/Pesquise conceitos/i);
    const searchBtn = screen.getByRole('button', { name: /Buscar/i });
    fireEvent.change(searchInput, { target: { value: 'longo' } });
    fireEvent.click(searchBtn);

    // Verify "Ver mais" is displayed
    const showMoreBtn = await screen.findByRole('button', { name: /Ver mais/i });
    expect(showMoreBtn).toBeInTheDocument();

    // Click "Ver mais"
    fireEvent.click(showMoreBtn);

    // Verify preview modal is opened and displays complete content
    expect(screen.getByText('Documento Muito Longo', { selector: 'h2' })).toBeInTheDocument();
    const modalBody = container.querySelector('.doc-preview-body');
    expect(modalBody).toBeInTheDocument();
    expect(modalBody?.textContent).toContain('Linha 1');
    expect(modalBody?.textContent).toContain('Linha 5');

    // Close modal
    const closeBtn = screen.getByRole('button', { name: /Fechar/i });
    fireEvent.click(closeBtn);

    // Verify modal is closed
    expect(screen.queryByText('Documento Muito Longo', { selector: 'h2' })).not.toBeInTheDocument();

    // Restore original property descriptors
    if (originalScrollHeight) {
      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScrollHeight);
    } else {
      delete (HTMLElement.prototype as any).scrollHeight;
    }

    if (originalClientHeight) {
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight);
    } else {
      delete (HTMLElement.prototype as any).clientHeight;
    }
  });

  it('should render "Excluir Todos" button, open confirmation modal, and call api.deleteAllDocuments on confirm', async () => {
    (api.listDocuments as any).mockResolvedValue([
      { id: 1, titulo: 'Doc 1', created_at: '2026-06-05T12:00:00Z' }
    ]);
    (api.deleteAllDocuments as any).mockResolvedValue({ success: true });

    render(<Dashboard onLogout={() => {}} />);

    // Wait for document to load and button to be visible
    const deleteAllBtn = await screen.findByTitle('Excluir Todos os Documentos');
    expect(deleteAllBtn).toBeInTheDocument();

    // Click the delete all button
    fireEvent.click(deleteAllBtn);

    // Verify confirmation modal is displayed
    expect(screen.getByText('Confirmar Exclusão Total')).toBeInTheDocument();

    // Click cancel first to test close behavior
    const cancelBtn = screen.getByRole('button', { name: /Cancelar/i });
    fireEvent.click(cancelBtn);
    expect(screen.queryByText('Confirmar Exclusão Total')).not.toBeInTheDocument();

    // Open again
    fireEvent.click(deleteAllBtn);

    // Click confirm deletion
    const confirmBtn = screen.getByRole('button', { name: /Sim, Excluir Tudo/i });
    fireEvent.click(confirmBtn);

    // Check mock API call
    expect(api.deleteAllDocuments).toHaveBeenCalled();
    
    // Verify modal is closed
    expect(screen.queryByText('Confirmar Exclusão Total')).not.toBeInTheDocument();
  });
});
