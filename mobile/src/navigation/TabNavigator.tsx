import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '../theme/ThemeContext';
import HomeScreen from '../screens/HomeScreen';
import ServicesScreen from '../screens/ServicesScreen';
import ProductsScreen from '../screens/ProductsScreen';
import LoyaltyScreen from '../screens/LoyaltyScreen';
import ServicesStack from './ServicesStack';
import ProductsStack from './ProductsStack';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  const { theme } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.tabActive,
        tabBarInactiveTintColor: theme.tabInactive,
        tabBarStyle: {
          backgroundColor: theme.tabBar,
          borderTopColor: theme.border,
        },
      }}
    >
      <Tab.Screen name="Accueil" component={HomeScreen} />
      <Tab.Screen name="Services" component={ServicesStack} />
      <Tab.Screen name="Fidélité" component={LoyaltyScreen} />
      <Tab.Screen name="Produits" component={ProductsStack} />

    </Tab.Navigator>
  );
}