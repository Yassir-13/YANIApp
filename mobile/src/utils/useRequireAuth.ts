import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../stores/authStore';

// Retourne une fonction : si l'utilisateur est connecté, exécute l'action ;
// sinon, ouvre l'écran de login.
export function useRequireAuth() {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);

  return (action: () => void) => {
    if (user) {
      action();
    } else {
      navigation.navigate('Login');
    }
  };
}