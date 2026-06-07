import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { DocumentForm } from '../components/DocumentForm';
import { api } from '../utils/api';

// Mock the API module
vi.mock('../utils/api', () => ({
  api: {
    getDocument: vi.fn(),
    createDocument: vi.fn(),
    updateDocument: vi.fn(),
  },
}));

describe('DocumentForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render form fields for adding a new document', () => {
    render(<DocumentForm documentId={null} onClose={() => {}} onSave={() => {}} />);

    expect(screen.getByText('Inserir Documento')).toBeInTheDocument();
    expect(screen.getByLabelText(/Título/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Conteúdo do Documento/i)).toBeInTheDocument();
    expect(screen.getByText(/upload de um arquivo/i)).toBeInTheDocument();
  });

  it('should call api.createDocument and onSave on submission when adding new document', async () => {
    const mockOnSave = vi.fn();
    const mockOnClose = vi.fn();
    (api.createDocument as any).mockResolvedValue({ success: true });

    render(<DocumentForm documentId={null} onClose={mockOnClose} onSave={mockOnSave} />);

    fireEvent.change(screen.getByLabelText(/Título/i), { target: { value: 'Novo Documento' } });
    fireEvent.change(screen.getByLabelText(/Conteúdo/i), { target: { value: 'Texto de conteúdo importante' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar/i }));

    await waitFor(() => {
      expect(api.createDocument).toHaveBeenCalledWith('Novo Documento', 'Texto de conteúdo importante');
      expect(mockOnSave).toHaveBeenCalled();
    });
  });

  it('should fetch and populate fields when editing an existing document', async () => {
    (api.getDocument as any).mockResolvedValue({
      id: 12,
      titulo: 'Documento Existente',
      conteudo: 'Conteúdo do documento existente'
    });

    render(<DocumentForm documentId={12} onClose={() => {}} onSave={() => {}} />);

    expect(screen.getByText('Carregando dados...')).toBeInTheDocument();

    await waitFor(() => {
      expect(api.getDocument).toHaveBeenCalledWith(12);
      expect(screen.getByLabelText(/Título/i)).toHaveValue('Documento Existente');
      expect(screen.getByLabelText(/Conteúdo/i)).toHaveValue('Conteúdo do documento existente');
    });
  });

  it('should call api.updateDocument and onSave on submission when editing document', async () => {
    (api.getDocument as any).mockResolvedValue({
      id: 12,
      titulo: 'Documento Existente',
      conteudo: 'Conteúdo existente'
    });
    (api.updateDocument as any).mockResolvedValue({ success: true });
    const mockOnSave = vi.fn();

    render(<DocumentForm documentId={12} onClose={() => {}} onSave={mockOnSave} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Título/i)).toHaveValue('Documento Existente');
    });

    fireEvent.change(screen.getByLabelText(/Título/i), { target: { value: 'Documento Atualizado' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar/i }));

    await waitFor(() => {
      expect(api.updateDocument).toHaveBeenCalledWith(12, 'Documento Atualizado', 'Conteúdo existente');
      expect(mockOnSave).toHaveBeenCalled();
    });
  });
});
