import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ProfileVisualizer } from '../../../components/ProfileVisualizer';
import { useAuth } from '../../../context/authProvider';

export default function ProfileScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  return (
    <View style={styles.container}>
      {/* Your existing profile content */}

      {/* Add the profile visualizer */}
      {userId && <ProfileVisualizer userId={userId} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
