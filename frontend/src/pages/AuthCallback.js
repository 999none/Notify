import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const userParam = searchParams.get('user');
    const errorParam = searchParams.get('error');
    const code = searchParams.get('code');

    if (errorParam) {
      setError(`Authentication failed: ${errorParam}`);
      setTimeout(() => navigate('/'), 3000);
      return;
    }

    // Case 1: Token received from backend redirect (server-side OAuth callback)
    if (token && userParam) {
      try {
        const userData = JSON.parse(decodeURIComponent(userParam));
        login(token, userData);
        navigate('/dashboard', { replace: true });
      } catch (err) {
        console.error('Failed to parse user data:', err);
        setError('Authentication failed. Please try again.');
        setTimeout(() => navigate('/'), 3000);
      }
      return;
    }

    // Case 2: Code received from Spotify (client-side callback fallback)
    if (code) {
      const handleCallback = async () => {
        try {
          const res = await authAPI.handleCallback(code);
          const { access_token, user } = res.data;
          login(access_token, user);
          navigate('/dashboard', { replace: true });
        } catch (err) {
          console.error('Auth callback error:', err);
          setError('Authentication failed. Please try again.');
          setTimeout(() => navigate('/'), 3000);
        }
      };
      handleCallback();
      return;
    }

    setError('No authorization data received.');
    setTimeout(() => navigate('/'), 3000);
  }, [searchParams, login, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505]" data-testid="auth-callback-page">
      <div className="glass-card p-12 text-center max-w-md">
        {error ? (
          <>
            <p className="text-red-400 text-lg mb-4" data-testid="auth-error">{error}</p>
            <p className="text-[#52525B] text-sm">Redirecting to home...</p>
          </>
        ) : (
          <>
            <Loader2 className="w-12 h-12 text-[#00C2FF] animate-spin mx-auto mb-6" />
            <h2 className="text-2xl font-semibold mb-2" style={{ fontFamily: 'Manrope' }}>Connecting to Spotify</h2>
            <p className="text-[#A1A1AA]">Setting up your session...</p>
          </>
        )}
      </div>
    </div>
  );
}
