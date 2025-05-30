import { createContext, useContext, useEffect, useState } from 'react';
import axios from './axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState({matchesPlayed: 0, matchesWon: 0});

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {data} = await axios.get('/users/profile', {
          withCredentials: true,
        });
        if(data.success === false) {
          setUser(null);
          // Remove localStorage user if backend says not authenticated
          localStorage.removeItem('ranked_user');
          return;
        }
        setUser(data.user);
        setUserStats({
          matchesPlayed: data.matchesPlayed || 0,
          matchesWon: data.matchesWon || 0,
        });
        // Store user in localStorage for persistence
        localStorage.setItem('ranked_user', JSON.stringify(data.user));
      } catch {
        setUser(null);
        localStorage.removeItem('ranked_user');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const logout = async () => {
    await axios.post('users/logout');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, userStats, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
