// Import the CSS file first
import "./global.css";

// Import expo-router
import { ExpoRoot } from "expo-router";
import { registerRootComponent } from 'expo';

// Create the root component
function App() {
  const ctx = require.context("./app");
  return <ExpoRoot context={ctx} />;
}

// Register the root component
registerRootComponent(App);