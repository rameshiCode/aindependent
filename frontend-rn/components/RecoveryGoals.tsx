import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { useProfile } from '../hooks/useProfile';

// Component to display and manage user recovery goals
const RecoveryGoals = ({ goals = [], onRefresh }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [newGoalDescription, setNewGoalDescription] = useState('');
  const [newGoalDate, setNewGoalDate] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const { createGoal, updateGoal } = useProfile();
  
  // Handle creating a new goal
  const handleCreateGoal = async () => {
    if (!newGoalDescription.trim()) {
      Alert.alert('Error', 'Please enter a goal description');
      return;
    }
    
    const goalData = {
      description: newGoalDescription.trim(),
      target_date: newGoalDate || undefined
    };
    
    try {
      await createGoal(goalData);
      setNewGoalDescription('');
      setNewGoalDate('');
      setIsModalVisible(false);
      
      if (onRefresh) {
        onRefresh();
      }
      
      Alert.alert('Success', 'Goal created successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to create goal');
      console.error(error);
    }
  };
  
  // Handle updating goal status
  const handleUpdateGoalStatus = async (goalId, newStatus) => {
    try {
      await updateGoal(goalId, { status: newStatus });
      
      if (onRefresh) {
        onRefresh();
      }
      
      Alert.alert('Success', `Goal marked as ${newStatus}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update goal status');
      console.error(error);
    }
  };
  
  // Handle updating goal progress
  const handleUpdateProgress = async (goalId) => {
    try {
      await updateGoal(goalId, { 
        progress: progress,
        metadata: { 
          progress: progress,
          last_updated: new Date().toISOString()
        }
      });
      
      if (onRefresh) {
        onRefresh();
      }
      
      setSelectedGoal(null);
      Alert.alert('Success', 'Progress updated successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to update progress');
      console.error(error);
    }
  };
  
  // Modal for creating a new goal
  const renderCreateModal = () => (
    <Modal
      visible={isModalVisible && isCreating}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setIsModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Create New Goal</Text>
          
          <Text style={styles.inputLabel}>Goal Description:</Text>
          <TextInput
            style={styles.textInput}
            value={newGoalDescription}
            onChangeText={setNewGoalDescription}
            placeholder="Enter your goal"
            multiline
          />
          
          <Text style={styles.inputLabel}>Target Date (optional):</Text>
          <TextInput
            style={styles.textInput}
            value={newGoalDate}
            onChangeText={setNewGoalDate}
            placeholder="YYYY-MM-DD"
          />
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setIsModalVisible(false)}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalButton, styles.confirmButton]}
              onPress={handleCreateGoal}
            >
              <Text style={styles.buttonText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
  
  // Modal for updating goal progress
  const renderProgressModal = () => (
    <Modal
      visible={isModalVisible && !isCreating && selectedGoal !== null}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {
        setIsModalVisible(false);
        setSelectedGoal(null);
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Update Goal Progress</Text>
          
          {selectedGoal && (
            <Text style={styles.goalDescription}>{selectedGoal.description}</Text>
          )}
          
          <Text style={styles.inputLabel}>Progress ({progress}%):</Text>
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>
          
          <View style={styles.progressButtonsRow}>
            {[0, 25, 50, 75, 100].map(value => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.progressButton,
                  progress === value && styles.activeProgressButton
                ]}
                onPress={() => setProgress(value)}
              >
                <Text style={styles.progressButtonText}>{value}%</Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => {
                setIsModalVisible(false);
                setSelectedGoal(null);
              }}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalButton, styles.confirmButton]}
              onPress={() => handleUpdateProgress(selectedGoal.id)}
            >
              <Text style={styles.buttonText}>Update</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
  
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Recovery Goals</Text>
        
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            setIsCreating(true);
            setIsModalVisible(true);
          }}
        >
          <Text style={styles.addButtonText}>+ New Goal</Text>
        </TouchableOpacity>
      </View>
      
      {goals.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No goals yet. Tap "New Goal" to create your first recovery goal.
          </Text>
        </View>
      ) : (
        <View style={styles.goalsList}>
          {goals.map(goal => (
            <View
              key={goal.id}
              style={[
                styles.goalCard,
                {
                  backgroundColor:
                    goal.status === 'active'
                      ? '#4ecdc433'
                      : goal.status === 'completed'
                      ? '#10b98133'
                      : '#ff6b6b33'
                }
              ]}
            >
              <View style={styles.goalHeader}>
                <View
                  style={[
                    styles.goalStatusDot,
                    {
                      backgroundColor:
                        goal.status === 'active'
                          ? '#4ecdc4'
                          : goal.status === 'completed'
                          ? '#10b981'
                          : '#ff6b6b'
                    }
                  ]}
                />
                <Text style={styles.goalTitle}>{goal.description}</Text>
              </View>
              
              {goal.metadata?.progress !== undefined && (
                <View style={styles.progressContainer}>
                  <Text style={styles.progressLabel}>Progress:</Text>
                  <View style={styles.progressBarContainer}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${goal.metadata.progress}%` }
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>{goal.metadata.progress}%</Text>
                </View>
              )}
              
              <View style={styles.goalDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <Text style={styles.detailValue}>
                    {goal.status.charAt(0).toUpperCase() + goal.status.slice(1)}
                  </Text>
                </View>
                
                {goal.target_date && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Target:</Text>
                    <Text style={styles.detailValue}>
                      {new Date(goal.target_date).toLocaleDateString()}
                    </Text>
                  </View>
                )}
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Created:</Text>
                  <Text style={styles.detailValue}>
                    {new Date(goal.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              
              <View style={styles.goalActions}>
                {goal.status === 'active' && (
                  <>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.progressButton]}
                      onPress={() => {
                        setIsCreating(false);
                        setSelectedGoal(goal);
                        setProgress(goal.metadata?.progress || 0);
                        setIsModalVisible(true);
                      }}
                    >
                      <Text style={styles.actionButtonText}>Update Progress</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.actionButton, styles.completeButton]}
                      onPress={() => handleUpdateGoalStatus(goal.id, 'completed')}
                    >
                      <Text style={styles.actionButtonText}>Mark Complete</Text>
                    </TouchableOpacity>
                  </>
                )}
                
                {goal.status === 'completed' && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.reactivateButton]}
                    onPress={() => handleUpdateGoalStatus(goal.id, 'active')}
                  >
                    <Text style={styles.actionButtonText}>Reactivate</Text>
                  </TouchableOpacity>
                )}
                
                {goal.status === 'abandoned' && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.reactivateButton]}
                    onPress={() => handleUpdateGoalStatus(goal.id, 'active')}
                  >
                    <Text style={styles.actionButtonText}>Restart</Text>
                  </TouchableOpacity>
                )}
                
                {goal.status === 'active' && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.abandonButton]}
                    onPress={() => handleUpdateGoalStatus(goal.id, 'abandoned')}
                  >
                    <Text style={styles.actionButtonText}>Abandon</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
      
      {renderCreateModal()}
      {renderProgressModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#3498db',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  addButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 20,
    backgroundColor: '#f5f7fa',
    borderRadius: 8,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
  },
  goalsList: {},
  goalCard: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  goalStatusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  progressContainer: {
    marginBottom: 10,
  },
  progressLabel: {
    fontSize: 14,
    marginBottom: 4,
    color: '#666',
  },
  progressBarContainer: {
    height: 10,
    backgroundColor: '#e0e0e0',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3498db',
    borderRadius: 5,
  },
  progressText: {
    fontSize: 12,
    textAlign: 'right',
  },
  goalDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  detailLabel: {
    width: 60,
    fontSize: 12,
    color: '#666',
  },
  detailValue: {
    fontSize: 12,
  },
  goalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginRight: 8,
    marginBottom: 8,
  },
  progressButton: {
    backgroundColor: '#3498db',
  },
  completeButton: {
    backgroundColor: '#10b981',
  },
  abandonButton: {
    backgroundColor: '#ff6b6b',
  },
  reactivateButton: {
    backgroundColor: '#f59e0b',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  goalDescription: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 4,
    color: '#666',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
    marginBottom: 16,
    fontSize: 14,
  },
  progressButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  progressButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
  },
  activeProgressButton: {
    backgroundColor: '#3498db',
  },
  progressButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    padding: 10,
    borderRadius: 6,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#e0e0e0',
  },
  confirmButton: {
    backgroundColor: '#3498db',
  },
  buttonText: {
    fontWeight: '600',
    color: 'white',
  },
});

export default RecoveryGoals;