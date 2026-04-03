import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AppProviders } from "./src/providers/AppProviders.tsx";
import { RootNavigator } from "./src/navigation/index.tsx";

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProviders>
        <StatusBar style="dark" />
        <RootNavigator />
      </AppProviders>
    </GestureHandlerRootView>
  );
}
