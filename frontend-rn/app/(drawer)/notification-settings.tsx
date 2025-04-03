import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '@/src/client/client.gen';

interface NotificationSettings {
  goal_reminders: boolean;
  abstinence_milestones: boolean;
  risk_alerts: boolean;
  daily_check_ins: boolean;
}

export default function NotificationSettingsScreen() {
  const queryClient = useQueryClient();

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({}, 'inputBackground');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({}, 'inputBorder');

  // State for notification settings
  // In a real implementation, these would be fetched from the backend
  const [settings, setSettings] = useState<NotificationSettings>({
    goal_reminders: true,
    abstinence_milestones: true,
    risk_alerts: true,
    daily_check_ins: false,
  });

  // Toggle setting
  const toggleSetting = (setting: keyof NotificationSettings) => {
    setSettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));

    // In a real implementation, this would update the backend
    // For now, we'll just show an alert
    Alert.alert(
      "Settings Updated",
      `${setting.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')} notifications ${!settings[setting] ? 'enabled' : 'disabled'}.`,
      [{ text: "OK" }]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['bottom']}>
      <Stack.Screen options={{ title: "Notification Settings" }} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}>
          <Text style={[styles.cardTitle, { color: textColor }]}>
            Notification Preferences
          </Text>
          <Text style={[styles.cardDescription, { color: textColor }]}>
            Customize which notifications you receive from the app.
          </Text>

          <View style={styles.settingsList}>
            {/* Goal Reminders */}
            <View style={[styles.settingItem, { borderBottomColor: borderColor }]}>
              <View style={styles.settingInfo}>
                <Ionicons name="flag-outline" size={24} color={tintColor} style={styles.settingIcon} />
                <View>
                  <Text style={[styles.settingTitle, { color: textColor }]}>
                    Goal Reminders
                  </Text>
                  <Text style={[styles.settingDescription, { color: `${textColor}80` }]}>
                    Receive reminders about your recovery goals
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.goal_reminders}
                onValueChange={() => toggleSetting('goal_reminders')}
                trackColor={{ false: '#767577', true: `${tintColor}80` }}
                thumbColor={settings.goal_reminders ? tintColor : '#f4f3f4'}
              />
            </View>

            {/* Abstinence Milestones */}
            <View style={[styles.settingItem, { borderBottomColor: borderColor }]}>
              <View style={styles.settingInfo}>
                <Ionicons name="trophy-outline" size={24} color={tintColor} style={styles.settingIcon} />
                <View>
                  <Text style={[styles.settingTitle, { color: textColor }]}>
                    Abstinence Milestones
                  </Text>
                  <Text style={[styles.settingDescription, { color: `${textColor}80` }]}>
                    Celebrate your progress with milestone notifications
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.abstinence_milestones}
                onValueChange={() => toggleSetting('abstinence_milestones')}
                trackColor={{ false: '#767577', true: `${tintColor}80` }}
                thumbColor={settings.abstinence_milestones ? tintColor : '#f4f3f4'}
              />
            </View>

            {/* Risk Alerts */}
            <View style={[styles.settingItem, { borderBottomColor: borderColor }]}>
              <View style={styles.settingInfo}>
                <Ionicons name="warning-outline" size={24} color={tintColor} style={styles.settingIcon} />
                <View>
                  <Text style={[styles.settingTitle, { color: textColor }]}>
                    Risk Alerts
                  </Text>
                  <Text style={[styles.settingDescription, { color: `${textColor}80` }]}>
                    Get notified when your relapse risk score increases
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.risk_alerts}
                onValueChange={() => toggleSetting('risk_alerts')}
                trackColor={{ false: '#767577', true: `${tintColor}80` }}
                thumbColor={settings.risk_alerts ? tintColor : '#f4f3f4'}
              />
            </View>

            {/* Daily Check-ins */}
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Ionicons name="calendar-outline" size={24} color={tintColor} style={styles.settingIcon} />
                <View>
                  <Text style={[styles.settingTitle, { color: textColor }]}>
                    Daily Check-ins
                  </Text>
                  <Text style={[styles.settingDescription, { color: `${textColor}80` }]}>
                    Receive daily reminders to check in with your therapist
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.daily_check_ins}
                onValueChange={() => toggleSetting('daily_check_ins')}
                trackColor={{ false: '#767577', true: `${tintColor}80` }}
                thumbColor={settings.daily_check_ins ? tintColor : '#f4f3f4'}
              />
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}>
          <Text style={[styles.cardTitle, { color: textColor }]}>
            Notification Schedule
          </Text>
          <Text style={[styles.cardDescription, { color: textColor }]}>
            Set your preferred notification times.
          </Text>

          <TouchableOpacity
            style={[styles.scheduleButton, { backgroundColor: tintColor }]}
            onPress={() => Alert.alert("Coming Soon", "This feature will be available in a future update.")}
          >
            <Text style={styles.scheduleButtonText}>Configure Schedule</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    marginBottom: 20,
  },
  settingsList: {
    marginTop: 8,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
  },
  scheduleButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  scheduleButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
