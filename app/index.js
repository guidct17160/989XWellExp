import React, { useEffect, useState } from 'react';
import { Text, ScrollView } from 'react-native';
import { registerRootComponent } from 'expo';

if (typeof document !== 'undefined') {
  document.title = 'WellX989';
}

// If anything fails while the app module loads, show the real error instead of a blank screen.
const StartupError = ({ error }) => (
  <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 64 }}>
    <Text style={{ fontSize: 18, fontWeight: '700', color: '#B91C1C', marginBottom: 12 }}>เปิดแอปไม่สำเร็จ</Text>
    <Text selectable style={{ fontSize: 12, color: '#111827' }}>
      {String((error && (error.stack || error.message)) || error)}
    </Text>
  </ScrollView>
);

// "main" must be registered synchronously: React Native starts the app as soon as the bundle has
// loaded, and a component registered later (after an await) gives "App entry not found".
// Services read persisted state (session, PIN flags, caches) when their modules load, so the
// native storage shim must be ready before App (and everything it imports) is required.
// This root waits for the shim, then loads App (required inside, so a native import error is caught too).
function Root() {
  const [App, setApp] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.resolve()
      .then(() => require('./src/utils/nativeStorage').installNativeStorage())
      .then(() => require('./App').default)
      .then((Loaded) => alive && setApp(() => Loaded))
      .catch((err) => {
        console.error('App failed to start', err);
        if (alive) setError(err);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <StartupError error={error} />;
  return App ? <App /> : null;
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => Root);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(Root);
