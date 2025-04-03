import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '@/src/client/client.gen';

// Define notification settings type
interface NotificationSettings {
  goal_reminders: boolean;
  abstinence_milestones: boolean;
  risk_alerts: boolean;
  daily_check_ins: boolean;
  app_updates: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string; // HH:MM format
  quiet_hours_end: string; // HH:MM format
}

export default function NotificationSettingsScreen() {
  const queryClient = useQueryClient();

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({}, 'inputBackground');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({}, 'inputBorder');

  // Default notification settings
  const defaultSettings: NotificationSettings = {
    goal_reminders: true,
    abstinence_milestones: true,
    risk_alerts: true,
    daily_check_ins: false,
    app_updates: true,
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00'
  };

  // State for notification settings
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);

  // State for tracking whether settings have changed
  const [hasChanges, setHasChanges] = useState(false);

  // Mock query for fetching notification settings
  // In a real implementation, this would be a real endpoint
  const {
    data: fetchedSettings,
    isLoading,
    isError,
    refetch
  } = useQuery({
    queryKey: ['notificationSettings'],
    queryFn: async () => {
      try {
        // This is where you would make an actual API call
        // For now, we'll simulate a response
        // Replace this with actual endpoint when available

        // Simulated API call for demo purposes
        await new Promise(resolve => setTimeout(resolve, 1000));

        // In the real implementation, you would do:
        // const response = await client.get({
        //   path: '/api/v1/notifications/settings',
        //   throwOnError: true
        // });
        // return response.data as NotificationSettings;

        // For now, return defaults
        return defaultSettings;
      } catch (err) {
        console.error('Error fetching notification settings:', err);
        throw err;
      }
    },
    retry: 2
  });

  // Mock mutation for saving notification settings
  const saveSettings = useMutation({
    mutationFn: async (updatedSettings: NotificationSettings) => {
      try {
        // This is where you would make an actual API call
        // For now, we'll simulate a response
        // Replace this with actual endpoint when available

        // Simulated API call
        await new Promise(resolve => setTimeout(resolve, 1000));

        // In the real implementation, you would do:
        // const response = await client.post({
        //   path: '/api/v1/notifications/settings',
        //   body: updatedSettings,
        //   throwOnError: true
        // });
        // return response.data;

        // For now, just return the settings
        return updatedSettings;
      } catch (err) {
        console.error('Error saving notification settings:', err);
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationSettings'] });
      setHasChanges(false);
      Alert.alert(
        "Settings Saved",
        "Your notification preferences have been updated.",
        [{ text: "OK" }]
      );
    },
    onError: (error) => {
      Alert.alert(
        "Error",
        "Failed to save notification settings. Please try again.",
        [{ text: "OK" }]
      );
    }
  });

  // Update settings when fetched
  useEffect(() => {
    if (fetchedSettings) {
      setSettings(fetchedSettings);
    }
  }, [fetchedSettings]);

  // Toggle setting
  const toggleSetting = (setting: keyof NotificationSettings) => {
    setSettings(prev => {
      const newSettings = {
        ...prev,
        [setting]: !prev[setting]
      };

      setHasChanges(true);
      return newSettings;
    });
  };

  // Handle save button press
  const handleSave = () => {
    saveSettings.mutate(settings);
  };

  // Setting sections data for rendering
  const settingSections = [
    {
      title: "Notification Types",
      settings: [
        {
          key: "goal_reminders" as keyof NotificationSettings,
          title: "Goal Reminders",
          description: "Notifications about your set goals and milestones",
          icon: "flag-outline"
        },
        {
          key: "abstinence_milestones" as keyof NotificationSettings,
          title: "Achievement Alerts",
          description: "Celebrate your progress with milestone notifications",
          icon: "trophy-outline"
        },
        {
          key: "risk_alerts" as keyof NotificationSettings,
          title: "Risk Alerts",
          description: "Get notified during high-risk periods",
          icon: "warning-outline"
        },
        {
          key: "daily_check_ins" as keyof NotificationSettings,
          title: "Daily Check-ins",
          description: "Reminders to check in with the app daily",
          icon: "calendar-outline"
        },
        {
          key: "app_updates" as keyof NotificationSettings,
          title: "App Updates",
          description: "Important updates about the app",
          icon: "information-circle-outline"
        }
      ]
    },
    {
      title: "Quiet Hours",
      settings: [
        {
          key: "quiet_hours_enabled" as keyof NotificationSettings,
          title: "Enable Quiet Hours",
          description: "No notifications during specified hours",
          icon: "moon-outline"
        }
      ]
    }
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['bottom']}>
      <Stack.Screen options={{ title: "Notification Settings" }} />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={tintColor} />
          <Text style={[styles.loadingText, { color: textColor }]}>
            Loading settings...
          </Text>
        </View>
      ) : isError ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#ff3b30" />
          <Text style={styles.errorText}>Failed to load settings</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: tintColor }]}
            onPress={() => refetch()}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Main settings sections */}
          {settingSections.map((section, sectionIndex) => (
            <View
              key={`section-${sectionIndex}`}
              style={[
                styles.card,
                { backgroundColor: cardBackground, borderColor }
              ]}
            >
              <Text style={[styles.cardTitle, { color: textColor }]}>
                {section.title}
              </Text>

              {section.settings.map((setting, index) => (
                <View
                  key={`setting-${setting.key}`}
                  style={[
                    styles.settingItem,
                    index < section.settings.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: borderColor
                    }
                  ]}
                >
                  <View style={styles.settingInfo}>
                    <Ionicons
                      name={setting.icon as any}
                      size={24}
                      color={tintColor}
                      style={styles.settingIcon}
                    />
                    <View>
                      <Text style={[styles.settingTitle, { color: textColor }]}>
                        {setting.title}
                      </Text>
                      <Text style={[styles.settingDescription, { color: `${textColor}80` }]}>
                        {setting.description}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={settings[setting.key]}
                    onValueChange={() => toggleSetting(setting.key)}
                    trackColor={{ false: '#767577', true: `${tintColor}80` }}
                    thumbColor={settings[setting.key] ? tintColor : '#f4f3f4'}
                  />
                </View>
              ))}

              {/* Time picker for quiet hours */}
              {section.title === "Quiet Hours" && settings.quiet_hours_enabled && (
                <View style={styles.timePickerContainer}>
                  <Text style={[styles.timePickerLabel, { color: textColor }]}>
                    No notifications will be sent between:
                  </Text>
                  <View style={styles.timeRangeContainer}>
                    <TouchableOpacity
                      style={[styles.timeButton, { borderColor }]}
                      onPress={() => {
                        // Here you'd show a time picker and update settings.quiet_hours_start
                        Alert.alert("Coming Soon", "Time picker will be implemented in a future update.");
                      }}
                    >
                      <Text style={[styles.timeButtonText, { color: textColor }]}>
                        {settings.quiet_hours_start}
                      </Text>
                    </TouchableOpacity>
                    <Text style={[styles.timeRangeSeparator, { color: textColor }]}>to</Text>
                    <TouchableOpacity
                      style={[styles.timeButton, { borderColor }]}
                      onPress={() => {
                        // Here you'd show a time picker and update settings.quiet_hours_end
                        Alert.alert("Coming Soon", "Time picker will be implemented in a future update.");
                      }}
                    >
                      <Text style={[styles.timeButtonText, { color: textColor }]}>
                        {settings.quiet_hours_end}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))}

          {/* Save button */}
          <TouchableOpacity
            style={[
              styles.saveButton,
              { backgroundColor: tintColor, opacity: hasChanges ? 1 : 0.5 }
            ]}
            onPress={handleSave}
            disabled={!hasChanges || saveSettings.isPending}
          >
            {saveSettings.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>

          {/* Help text */}
          <Text style={[styles.helpText, { color: `${textColor}80` }]}>
            Notifications help you stay on track with your recovery journey.
            You can adjust your preferences at any time.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 16,
    marginTop: 12,
    marginBottom: 24,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
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
  timePickerContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  timePickerLabel: {
    fontSize: 16,
    marginBottom: 12,
  },
  timeRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 100,
    alignItems: 'center',
  },
  timeButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  timeRangeSeparator: {
    marginHorizontal: 16,
    fontSize: 16,
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  helpText: {
    textAlign: 'center',
    fontSize: 14,
    paddingHorizontal: 24,
    marginBottom: 16,
  }
});
