import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppServicesProvider } from './src/contexts/AppContext';
import EnrollmentScreen from './src/screens/EnrollmentScreen';
import AuthenticationScreen from './src/screens/AuthenticationScreen';
import LivenessChallengeScreen from './src/screens/LivenessChallengeScreen';
import ResultScreen from './src/screens/ResultScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <AppServicesProvider>
        <NavigationContainer>
          <Stack.Navigator initialRouteName="Enrollment" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000' } }}>
            <Stack.Screen name="Enrollment" component={EnrollmentScreen} />
            <Stack.Screen name="Authentication" component={AuthenticationScreen} />
            <Stack.Screen name="Liveness" component={LivenessChallengeScreen} />
            <Stack.Screen name="Result" component={ResultScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </AppServicesProvider>
    </SafeAreaProvider>
  );
}
