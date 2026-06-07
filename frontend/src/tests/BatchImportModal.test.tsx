import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { BatchImportModal } from '../components/BatchImportModal';
import { api } from '../utils/api';

// Mock the API module
vi.mock('../utils/api', () => ({
  api: {
    importDocument: vi.fn(),
  },
}));

describe('BatchImportModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the modal header and drag-and-drop area', () => {
    render(<BatchImportModal onClose={() => {}} onSave={() => {}} />);
    
    expect(screen.getByText('Importar Lote de Documentos (JSON)')).toBeInTheDocument();
    expect(screen.getByText('Arraste ou clique para fazer upload do arquivo JSON de lote')).toBeInTheDocument();
    expect(screen.getByText('Confirmar Importação')).toBeDisabled();
  });

  it('should validate and parse a correct JSON file', async () => {
    const { container } = render(<BatchImportModal onClose={() => {}} onSave={() => {}} />);
    
    const validData = [
      { nome: 'doc1.txt', conteudo: 'YWJj' },
      { nome: 'doc2.txt', conteudo: 'eHl6' }
    ];
    const file = new File([JSON.stringify(validData)], 'lote.json', { type: 'application/json' });
    
    const fileInput = container.querySelector('#jsonFileInput')!;
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(screen.getByText(/O arquivo contém/)).toBeInTheDocument();
      expect(container.querySelector('strong')?.textContent).toBe('2');
      expect(screen.getByText(/doc1.txt/)).toBeInTheDocument();
      expect(screen.getByText(/doc2.txt/)).toBeInTheDocument();
      expect(screen.getByText('Confirmar Importação')).toBeEnabled();
    });
  });

  it('should display error if JSON format is invalid (not an array)', async () => {
    const { container } = render(<BatchImportModal onClose={() => {}} onSave={() => {}} />);
    
    const invalidData = { nome: 'doc1.txt', conteudo: 'YWJj' }; // Not an array
    const file = new File([JSON.stringify(invalidData)], 'lote.json', { type: 'application/json' });
    
    const fileInput = container.querySelector('#jsonFileInput')!;
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(screen.getByText(/O arquivo JSON deve conter uma lista\/array na raiz/)).toBeInTheDocument();
      expect(screen.getByText('Confirmar Importação')).toBeDisabled();
    });
  });

  it('should display error if array items lack required keys', async () => {
    const { container } = render(<BatchImportModal onClose={() => {}} onSave={() => {}} />);
    
    const invalidItems = [{ title: 'doc1.txt', content: 'YWJj' }]; // Wrong property names
    const file = new File([JSON.stringify(invalidItems)], 'lote.json', { type: 'application/json' });
    
    const fileInput = container.querySelector('#jsonFileInput')!;
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(screen.getByText(/Cada item da lista deve possuir as propriedades "nome" \(string\) e "conteudo" \(string em base64\)/)).toBeInTheDocument();
      expect(screen.getByText('Confirmar Importação')).toBeDisabled();
    });
  });

  it('should execute import requests sequentially and track progress stats', async () => {
    const onCloseMock = vi.fn();
    const onSaveMock = vi.fn();
    const { container } = render(<BatchImportModal onClose={onCloseMock} onSave={onSaveMock} />);
    
    const validData = [
      { nome: 'doc1.txt', conteudo: 'YWJj' },
      { nome: 'doc2.txt', conteudo: 'eHl6' },
      { nome: 'doc3.txt', conteudo: 'cXE=' }
    ];
    const file = new File([JSON.stringify(validData)], 'lote.json', { type: 'application/json' });
    
    const fileInput = container.querySelector('#jsonFileInput')!;
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(screen.getByText('Confirmar Importação')).toBeEnabled();
    });

    // Mock sequential responses
    (api.importDocument as any)
      .mockResolvedValueOnce({ success: true, action: 'created', id: 101 })
      .mockResolvedValueOnce({ success: true, action: 'updated', id: 102 })
      .mockRejectedValueOnce(new Error('Gemini quota exceeded'));

    fireEvent.click(screen.getByText('Confirmar Importação'));

    // Verify progress UI and stat counter boxes
    await waitFor(() => {
      expect(screen.getByText('Importação concluída!')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
      
      // Checking stats card counters
      const createdCard = container.querySelector('.import-summary-card.created .stat-val')!;
      const updatedCard = container.querySelector('.import-summary-card.updated .stat-val')!;
      const skippedCard = container.querySelector('.import-summary-card.skipped .stat-val')!;
      const failedCard = container.querySelector('.import-summary-card.failed .stat-val')!;

      expect(createdCard.textContent).toBe('1');
      expect(updatedCard.textContent).toBe('1');
      expect(skippedCard.textContent).toBe('0');
      expect(failedCard.textContent).toBe('1');
      
      // Verify terminal log outputs
      expect(screen.getByText(/Processando "doc1.txt".../)).toBeInTheDocument();
      expect(screen.getByText(/Criado no banco de dados/)).toBeInTheDocument();
      expect(screen.getByText(/Processando "doc2.txt".../)).toBeInTheDocument();
      expect(screen.getByText(/Conteúdo atualizado no banco/)).toBeInTheDocument();
      expect(screen.getByText(/Processando "doc3.txt".../)).toBeInTheDocument();
      expect(screen.getAllByText(/Gemini quota exceeded/).length).toBe(2);

      // Verify fail details details
      expect(screen.getByText('Detalhes das Falhas (1)')).toBeInTheDocument();
      expect(screen.getByText('doc3.txt')).toBeInTheDocument();
    });

    // Click conclude button
    fireEvent.click(screen.getByText('Concluir'));
    expect(onSaveMock).toHaveBeenCalledTimes(1);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
});
