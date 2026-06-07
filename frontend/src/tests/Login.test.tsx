import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { Login } from '../components/Login';
import { api } from '../utils/api';

// Mock the API module
vi.mock('../utils/api', () => ({
  api: {
    login: vi.fn(),
  },
}));

describe('Login Component', () => {
  it('should render username and password fields', () => {
    render(<Login onLoginSuccess={() => {}} />);
    
    expect(screen.getByLabelText(/Usuário/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Senha/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Acessar Painel/i })).toBeInTheDocument();
  });

  it('should call api.login and onLoginSuccess on form submission with correct credentials', async () => {
    const mockOnLoginSuccess = vi.fn();
    (api.login as any).mockResolvedValue({ token: 'mock-jwt-token' });

    render(<Login onLoginSuccess={mockOnLoginSuccess} />);

    const userInput = screen.getByLabelText(/Usuário/i);
    const passwordInput = screen.getByLabelText(/Senha/i);
    const submitBtn = screen.getByRole('button', { name: /Acessar Painel/i });

    fireEvent.change(userInput, { target: { value: 'admin' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith('admin', 'password123');
      expect(mockOnLoginSuccess).toHaveBeenCalled();
    });
  });

  it('should display an error message on login failure', async () => {
    (api.login as any).mockRejectedValue(new Error('Credenciais inválidas'));

    render(<Login onLoginSuccess={() => {}} />);

    const userInput = screen.getByLabelText(/Usuário/i);
    const passwordInput = screen.getByLabelText(/Senha/i);
    const submitBtn = screen.getByRole('button', { name: /Acessar Painel/i });

    fireEvent.change(userInput, { target: { value: 'admin' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Credenciais inválidas')).toBeInTheDocument();
    });
  });
});
