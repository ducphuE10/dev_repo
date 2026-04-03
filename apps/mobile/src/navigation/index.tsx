import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { ScreenFrame } from "../components/ScreenFrame.tsx";
import { useAuthSession } from "../auth/AuthSessionProvider.tsx";
import { LoginScreen, RegisterScreen, WelcomeScreen } from "../screens/AuthScreens.tsx";
import {
  DupeDetailScreen,
  FeedScreen,
  NotificationsScreen,
  PostComposerScreen,
  ProfileScreen,
  SearchScreen
} from "../screens/MainScreens.tsx";
import { CategorySelectScreen, OnboardingCompleteScreen } from "../screens/OnboardingScreens.tsx";

type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
};

type OnboardingStackParamList = {
  CategorySelect: undefined;
  OnboardingComplete: undefined;
};

type HomeStackParamList = {
  FeedHome: undefined;
  DupeDetail: { postId: string };
};

type MainTabParamList = {
  Home: undefined;
  Search: undefined;
  Post: undefined;
  Notifications: undefined;
  Profile: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const MainTabs = createBottomTabNavigator<MainTabParamList>();

const navigationTheme = {
  dark: false,
  colors: {
    primary: "#FF5A36",
    background: "#F8EFE6",
    card: "#FFF9F2",
    text: "#22170F",
    border: "#E6D4C7",
    notification: "#FF5A36"
  },
  fonts: {
    regular: {
      fontFamily: "System",
      fontWeight: "400"
    },
    medium: {
      fontFamily: "System",
      fontWeight: "500"
    },
    bold: {
      fontFamily: "System",
      fontWeight: "700"
    },
    heavy: {
      fontFamily: "System",
      fontWeight: "800"
    }
  }
};

const authScreenOptions = {
  headerShadowVisible: false,
  headerStyle: {
    backgroundColor: "#F8EFE6"
  },
  headerTintColor: "#22170F",
  contentStyle: {
    backgroundColor: "#F8EFE6"
  }
} as const;

const AuthNavigator = () => (
  <AuthStack.Navigator initialRouteName="Welcome" screenOptions={authScreenOptions}>
    <AuthStack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
    <AuthStack.Screen name="Login" component={LoginScreen} options={{ title: "Log in" }} />
    <AuthStack.Screen name="Register" component={RegisterScreen} options={{ title: "Create account" }} />
  </AuthStack.Navigator>
);

const OnboardingNavigator = () => (
  <OnboardingStack.Navigator initialRouteName="CategorySelect" screenOptions={authScreenOptions}>
    <OnboardingStack.Screen
      name="CategorySelect"
      component={CategorySelectScreen}
      options={{ title: "Pick your categories" }}
    />
    <OnboardingStack.Screen
      name="OnboardingComplete"
      component={OnboardingCompleteScreen}
      options={{ title: "You’re in" }}
    />
  </OnboardingStack.Navigator>
);

const HomeNavigator = () => (
  <HomeStack.Navigator
    initialRouteName="FeedHome"
    screenOptions={{
      headerShadowVisible: false,
      headerStyle: {
        backgroundColor: "#FFF9F2"
      },
      headerTintColor: "#22170F",
      contentStyle: {
        backgroundColor: "#F8EFE6"
      }
    }}
  >
    <HomeStack.Screen name="FeedHome" component={FeedScreen} options={{ headerShown: false }} />
    <HomeStack.Screen name="DupeDetail" component={DupeDetailScreen} options={{ title: "Dupe detail" }} />
  </HomeStack.Navigator>
);

const MainNavigator = () => (
  <MainTabs.Navigator
    screenOptions={{
      headerShadowVisible: false,
      headerStyle: {
        backgroundColor: "#FFF9F2"
      },
      headerTintColor: "#22170F",
      tabBarActiveTintColor: "#FF5A36",
      tabBarInactiveTintColor: "#7A6656",
      tabBarStyle: {
        backgroundColor: "#FFF9F2",
        borderTopColor: "#E6D4C7",
        height: 72,
        paddingBottom: 12,
        paddingTop: 8
      }
    }}
  >
    <MainTabs.Screen name="Home" component={HomeNavigator} options={{ headerShown: false }} />
    <MainTabs.Screen name="Search" component={SearchScreen} />
    <MainTabs.Screen name="Post" component={PostComposerScreen} />
    <MainTabs.Screen name="Notifications" component={NotificationsScreen} />
    <MainTabs.Screen name="Profile" component={ProfileScreen} />
  </MainTabs.Navigator>
);

export const RootNavigator = () => {
  const { isHydrated, session } = useAuthSession();

  return (
    <NavigationContainer theme={navigationTheme}>
      {!isHydrated ? (
        <ScreenFrame
          eyebrow="Booting"
          title="Restoring your Dupe Hunt account"
          description="Refreshing the saved session, auth tokens, and onboarding state."
        />
      ) : !session ? (
        <AuthNavigator />
      ) : !session.hasCompletedOnboarding ? (
        <OnboardingNavigator />
      ) : (
        <MainNavigator />
      )}
    </NavigationContainer>
  );
};
