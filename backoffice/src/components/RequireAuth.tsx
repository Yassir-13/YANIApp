import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

type Role = 'STAFF' | 'ADMIN';

interface Props {
  children: ReactNode;
  // Rôles autorisés. Omis = toute personne du personnel connectée.
  roles?: Role[];
}

// Bloque l'accès aux pages tant que la session n'est pas chargée,
// puis redirige vers /login si l'utilisateur n'est pas du personnel.
//
// `roles` ferme en plus les pages réservées à l'administratrice. Sans lui, le
// contrôle n'existait QUE dans le menu : le lien vers /users était caché au
// personnel, mais taper l'adresse ouvrait la page. Le backend refusait bien les
// écritures — une employée voyait donc l'écran, la liste des clientes, et se
// heurtait à une erreur seulement au moment d'agir.
export default function RequireAuth({ children, roles }: Props) {
  const user = useAuthStore((s) => s.user);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  if (!isInitialized) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Connectée mais pas au bon niveau : retour au tableau de bord, et non vers
  // /login. Se reconnecter n'y changerait rien, et l'y renvoyer laisserait
  // croire que sa session a expiré.
  if (roles && !roles.includes(user.role as Role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
