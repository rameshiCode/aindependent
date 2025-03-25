// app/(app)/_layout.tsx
import { Drawer } from 'expo-router/drawer';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import CustomDrawerContent from '../../components/CustomDrawerContent';
import { useAuth } from '@/context/authProvider';
import { Redirect } from 'expo-router';
import { Text } from 'react-native';

export default function AppLayout() {
  const { session, isLoading } = useAuth();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  // Show a loading placeholder while checking authentication
  if (isLoading) {
    return <Text>Loading...</Text>;
  }

  // Redirect to the sign-in screen if the user is not authenticated
  if (!session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={{
          headerShown: false, // Hide the default header
          drawerStyle: {
            backgroundColor: isDarkMode ? '#1e1e1e' : '#fff',
            width: 280,
          },
          drawerActiveTintColor: isDarkMode ? '#fff' : '#000',
          drawerInactiveTintColor: isDarkMode ? '#aaa' : '#666',
        }}
      >
        <Drawer.Screen
          name="(drawer)"
          options={{
            headerShown: false,
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}
