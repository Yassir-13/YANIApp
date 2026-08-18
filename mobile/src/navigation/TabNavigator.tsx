import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';
import HomeScreen from '../screens/HomeScreen';
import ServicesStack from './ServicesStack';
import ProductsStack from './ProductsStack';
import LoyaltyScreen from '../screens/LoyaltyScreen';

const Tab = createBottomTabNavigator();

const ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  Accueil: { active: 'home', inactive: 'home-outline' },
  Services: { active: 'sparkles', inactive: 'sparkles-outline' },
  Produits: { active: 'bag-handle', inactive: 'bag-handle-outline' },
  Fidélité: { active: 'heart', inactive: 'heart-outline' },
};

export default function TabNavigator() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.tabActive,
        tabBarInactiveTintColor: theme.tabInactive,
        tabBarStyle: {
          backgroundColor: theme.tabBar,
          borderTopColor: theme.border,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 6,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icon = ICONS[route.name];
          const name = focused ? icon.active : icon.inactive;
          return <Ionicons name={name} size={size ?? 22} color={color} />;
        },
      })}
    >
      {/* `name` reste un identifiant technique — c'est lui que reçoivent les
          `navigation.navigate()` du reste de l'app. Seul `tabBarLabel` est
          traduit. */}
      <Tab.Screen name="Accueil" component={HomeScreen} options={{ tabBarLabel: t('nav.home') }} />
      <Tab.Screen
        name="Services"
        component={ServicesStack}
        options={{ tabBarLabel: t('nav.services') }}
        listeners={({ navigation }) => ({
          // Un onglet conserve l'état de sa pile : après avoir consulté une
          // prestation, revenir sur l'onglet réaffichait cette fiche au lieu
          // de la liste. Toucher l'onglet ramène toujours au catalogue.
          tabPress: () => {
            navigation.navigate('Services', { screen: 'ServicesList' });
          },
        })}
      />
      <Tab.Screen
        name="Produits"
        component={ProductsStack}
        options={{ tabBarLabel: t('nav.products') }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate('Produits', { screen: 'ProductsList' });
          },
        })}
      />
      <Tab.Screen name="Fidélité" component={LoyaltyScreen} options={{ tabBarLabel: t('nav.loyalty') }} />
    </Tab.Navigator>
  );
}