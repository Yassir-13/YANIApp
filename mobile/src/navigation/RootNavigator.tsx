import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TabNavigator from './TabNavigator';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { useAuthStore } from '../stores/authStore';
import { useTheme } from '../theme/ThemeContext';
import MyAppointmentsScreen from '../screens/MyAppointmentsScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import CartScreen from '../screens/CartScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import OrderConfirmationScreen from '../screens/OrderConfirmationScreen';
import MyOrdersScreen from '../screens/MyOrdersScreen';
import MyRewardsScreen from '../screens/MyRewardsScreen';
import VerifyEmailScreen from '../screens/VerifyEmailScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { theme } = useTheme();
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const loadSession = useAuthStore((s) => s.loadSession);

  useEffect(() => {
    loadSession();
  }, []);

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.gold} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={TabNavigator} />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="MyAppointments"
        component={MyAppointmentsScreen}
        options={{ presentation: 'modal' }}
      />

      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ presentation: 'modal' }}
      />

      <Stack.Screen name="Cart" 
      component={CartScreen} 
      options={{ presentation: 'modal' }} 
      />

      <Stack.Screen name="Checkout"
       component={CheckoutScreen}
        options={{ presentation: 'modal' }}
      />

      <Stack.Screen name="OrderConfirmation"
       component={OrderConfirmationScreen}
        options={{ presentation: 'modal' }} 
      />
      <Stack.Screen name="MyOrders"
       component={MyOrdersScreen}
        options={{ presentation: 'modal' }}
       />

      <Stack.Screen
        name="MyRewards"
        component={MyRewardsScreen}
        options={{ presentation: 'modal' }}
      />

      <Stack.Screen
        name="VerifyEmail"
        component={VerifyEmailScreen}
        options={{ presentation: 'modal' }}
      />

      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ presentation: 'modal' }}
      />

      <Stack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        options={{ presentation: 'modal' }}
      />

    </Stack.Navigator>
  );
}