import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI, userAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { Loader2, AlertCircle } from 'lucide-react';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState(null);
  const [processed, setProcessed] = useState(false);

  useEffect(() => {
    if (processed) return;
    setProcessed(true);

    const token = searchParams.get('token');
    const userParam = searchParams.get('user');
    const errorParam = searchParams.get('error');
    const code = searchParams.get('code');

    if (errorParam) {
      const decoded = decodeURIComponent(errorParam);
      if (decoded.includes('pas enregistre') || decoded.includes('not registered') || decoded.includes('403')) {
        setError("Ton compte Spotify n'est pas autorise. Va sur developer.spotify.com/dashboard et ajoute ton email dans User Management de l'app.");
      } else {
        setError(`Authentification echouee: ${decoded}`);
      }
      setTimeout(() => navigate('/'), 5000);
      return;
    }

    if (token) {
      const handleTokenLogin = async () => {
        try {
          let userData = null;
          if (userParam) {
            try {
              userData = JSON.parse(decodeURIComponent(userParam));
            } catch (parseErr) {
              // User data might be truncated, fetch from API instead
            }
          }
          
          // Store token first so API calls work
          localStorage.setItem('notify_token', token);
          
          if (!userData) {
            // Fetch user data from API
            try {
              const res = await userAPI.getMe();
              userData = res.data;
            } catch (fetchErr) {
              setError("Impossible de recuperer les donnees utilisateur. Veuillez reessayer.");
              localStorage.removeItem('notify_token');
              setTimeout(() => navigate('/'), 3000);
              return;
            }
          }
          
          login(token, userData);
          navigate('/dashboard', { replace: true });
        } catch (err) {
          setError("Authentification echouee. Veuillez reessayer.");
          localStorage.removeItem('notify_token');
          setTimeout(() => navigate('/'), 3000);
        }
      };
      handleTokenLogin();
      return;
    }

    if (code) {
      const handleCallback = async () => {
        try {
          const res = await authAPI.handleCallback(code);
          const { access_token, user } = res.data;
          login(access_token, user);
          navigate('/dashboard', { replace: true });
        } catch (err) {
          const detail = err.response?.data?.detail || '';
          if (detail.includes('pas enregistre') || detail.includes('403')) {
            setError("Ton compte Spotify n'est pas autorise. Va sur developer.spotify.com/dashboard et ajoute ton email dans User Management.");
          } else {
            setError("Authentification echouee. Veuillez reessayer.");
          }
          setTimeout(() => navigate('/'), 4000);
        }
      };
      handleCallback();
      return;
    }

    setError("Aucune donnee d'autorisation recue.");
    setTimeout(() => navigate('/'), 3000);
  }, [searchParams, login, navigate, processed]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F172A]" data-testid="auth-callback-page">
      <div className="glass-card p-12 text-center max-w-md">
        {error ? (
          <>
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-6" />
            <p className="text-red-400 text-lg mb-4" data-testid="auth-error">{error}</p>
            <p className="text-[#475569] text-sm">Redirection vers l'accueil...</p>
          </>
        ) : (
          <>
            <Loader2 className="w-12 h-12 text-[#4DA6FF] animate-spin mx-auto mb-6" />
            <h2 className="text-2xl font-semibold mb-2" style={{ fontFamily: 'Syne' }}>Connexion a Spotify</h2>
            <p className="text-[#94A3B8]">Configuration de la session...</p>
          </>
        )}
      </div>
    </div>
  );
}
