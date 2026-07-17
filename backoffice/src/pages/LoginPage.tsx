import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email.trim(), password);
      navigate('/');
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || 'Connexion impossible. Vérifiez vos identifiants.'
      );
    }
  };

  return (
    <div style={styles.page}>
      <form onSubmit={handleSubmit} className="card" style={styles.card}>
        <div style={styles.accent} />

        <div style={{ textAlign: 'center', marginBottom: 'var(--sp-5)' }}>
          <h1>Yani Concept</h1>
          <div className="label" style={{ color: 'var(--gold)', marginTop: 2 }}>
            Administration
          </div>
        </div>

        <label className="label" style={{ display: 'block', marginBottom: 6 }}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="proprietaire@yaniconcept.ma"
          autoComplete="username"
          required
        />

        <label className="label" style={{ display: 'block', margin: '14px 0 6px' }}>Mot de passe</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />

        {error && <div style={styles.error}>{error}</div>}

        <button type="submit" className="btn btn-gold" style={styles.submit} disabled={isLoading}>
          {isLoading ? 'Connexion…' : 'Se connecter'}
        </button>

        <div className="small muted" style={{ textAlign: 'center', marginTop: 'var(--sp-4)' }}>
          Accès réservé au personnel de l'institut.
        </div>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#14100c',
    padding: 'var(--sp-4)',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    padding: 'var(--sp-6)',
    position: 'relative',
    overflow: 'hidden',
  },
  accent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    background: 'linear-gradient(90deg, var(--gold-light), var(--gold))',
  },
  error: {
    marginTop: 'var(--sp-3)',
    padding: '8px 10px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--danger-bg)',
    color: 'var(--danger)',
    fontSize: 13,
  },
  submit: { width: '100%', marginTop: 'var(--sp-5)', padding: '11px' },
};
