const getHeaders = () => {
  const token = sessionStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  } as HeadersInit;
};

export const api = {
  async login(username: string, password: string) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao fazer login');
    sessionStorage.setItem('token', data.token);
    return data;
  },

  logout() {
    sessionStorage.removeItem('token');
  },

  isLoggedIn() {
    return !!sessionStorage.getItem('token');
  },

  async listDocuments() {
    const res = await fetch('/api/documents', { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao listar documentos');
    return data;
  },

  async getDocument(id: number) {
    const res = await fetch(`/api/documents/${id}`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao carregar documento');
    return data;
  },

  async createDocument(titulo: string, conteudo: string) {
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ titulo, conteudo })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao criar documento');
    return data;
  },

  async updateDocument(id: number, titulo: string, conteudo: string) {
    const res = await fetch(`/api/documents/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ titulo, conteudo })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao atualizar documento');
    return data;
  },

  async deleteDocument(id: number) {
    const res = await fetch(`/api/documents/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao excluir documento');
    return data;
  },

  async deleteAllDocuments() {
    const res = await fetch('/api/documents', {
      method: 'DELETE',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao excluir todos os documentos');
    return data;
  },

  async search(query: string, metric: 'COSINE' | 'DOT' | 'EUCLIDEAN' = 'COSINE') {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ query, metric })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao realizar busca vetorial');
    return data;
  },

  async importDocument(titulo: string, conteudoBase64: string) {
    const res = await fetch('/api/documents/import', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ titulo, conteudoBase64 })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao importar documento');
    return data;
  }
};
