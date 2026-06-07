import React, { useState } from 'react';
import { api } from './utils/api';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';

export const App: React.FC = () => {
  const [loggedIn, setLoggedIn] = useState(api.isLoggedIn());

  const handleLoginSuccess = () => {
    setLoggedIn(true);
  };

  const handleLogout = () => {
    api.logout();
    setLoggedIn(false);
  };

  if (!loggedIn) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return <Dashboard onLogout={handleLogout} />;
};

export default App;
