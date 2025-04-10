// frontend-rn/components/ProfileInsightsVisualization.tsx

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { ThemedText } from './ThemedText';
import { useThemeColor } from '../hooks/useThemeColor';
import { UserInsight } from '../hooks/useProfile';

interface ProfileInsightsVisualizationProps {
  insights: UserInsight[];
  onSelectInsight?: (insight: UserInsight) => void;
}

/**
 * A component for visualizing the relationships between different profile insights
 */
const ProfileInsightsVisualization: React.FC<ProfileInsightsVisualizationProps> = ({
  insights,
  onSelectInsight
}) => {
  const [nodes, setNodes] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');

  // Get color based on insight type
  const getTypeColor = (type: string): string => {
    switch(type) {
      case 'trigger': return '#ff6b6b';
      case 'psychological_trait': return '#4ecdc4';
      case 'coping_strategy': return '#ffd166';
      case 'recovery_stage': return '#3b82f6';
      case 'motivation': return '#10b981';
      default: return '#94a3b8';
    }
  };

  // Format insight type for display
  const formatType = (type: string): string => {
    if (!type) return '';
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Process insights to create visualization nodes and connections
  useEffect(() => {
    if (!insights || insights.length === 0) return;

    // Group insights by type
    const groupedInsights: { [key: string]: UserInsight[] } = {};
    insights.forEach(insight => {
      if (!groupedInsights[insight.type]) {
        groupedInsights[insight.type] = [];
      }
      groupedInsights[insight.type].push(insight);
    });

    // Create nodes based on insight groups
    const nodesList: any[] = [];
    let nodeIndex = 0;
    
    Object.keys(groupedInsights).forEach(type => {
      groupedInsights[type].forEach(insight => {
        nodesList.push({
          id: insight.id,
          type: insight.type,
          value: insight.value,
          index: nodeIndex++,
          radius: 30 + (insight.confidence || 0.5) * 20, // Size based on confidence
          color: getTypeColor(insight.type)
        });
      });
    });
    
    setNodes(nodesList);

    // Create connections between nodes
    const connectionsList: any[] = [];
    
    // Find related insights
    nodesList.forEach(sourceNode => {
      nodesList.forEach(targetNode => {
        if (sourceNode.id !== targetNode.id) {
          // Check if these insights are related
          const isRelated = areInsightsRelated(
            sourceNode.type, sourceNode.value,
            targetNode.type, targetNode.value
          );
          
          if (isRelated) {
            connectionsList.push({
              source: sourceNode.id,
              target: targetNode.id,
              strength: 0.7
            });
          }
        }
      });
    });
    
    setConnections(connectionsList);
    
  }, [insights]);

  // Check if two insights are related
  const areInsightsRelated = (
    sourceType: string,
    sourceValue: string,
    targetType: string,
    targetValue: string
  ): boolean => {
    // Convert to lowercase for comparison
    const sourceLower = sourceValue.toLowerCase();
    const targetLower = targetValue.toLowerCase();
    
    // Psychological traits related to triggers
    if (
      (sourceType === 'psychological_trait' && targetType === 'trigger') ||
      (sourceType === 'trigger' && targetType === 'psychological_trait')
    ) {
      // Define common relationships
      const triggerValue = sourceType === 'trigger' ? sourceLower : targetLower;
      const traitValue = sourceType === 'psychological_trait' ? sourceLower : targetLower;
      
      if (traitValue.includes('need_for_approval') &&
          (triggerValue.includes('social') || triggerValue.includes('friend'))) {
        return true;
      }

      if (traitValue.includes('low_self_confidence') &&
          (triggerValue.includes('stress') || triggerValue.includes('anxi'))) {
        return true;
      }

      if (traitValue.includes('fear_of_rejection') &&
          (triggerValue.includes('social') || triggerValue.includes('family'))) {
        return true;
      }
    }
    
    // Coping strategies related to triggers
    if (
      (sourceType === 'coping_strategy' && targetType === 'trigger') ||
      (sourceType === 'trigger' && targetType === 'coping_strategy')
    ) {
      const triggerValue = sourceType === 'trigger' ? sourceLower : targetLower;
      const strategyValue = sourceType === 'coping_strategy' ? sourceLower : targetLower;
      
      if ((strategyValue.includes('exercise') && triggerValue.includes('stress')) ||
          (strategyValue.includes('meditation') && triggerValue.includes('anxi')) ||
          (strategyValue.includes('call') && triggerValue.includes('lone')) ||
          (strategyValue.includes('support') && triggerValue.includes('urge'))) {
        return true;
      }
    }
    
    return false;
  };

  // Calculate positions for nodes in a circular layout
  const calculateNodePositions = () => {
    const width = Dimensions.get('window').width - 40; // Account for padding
    const height = 300; // Fixed height for visualization
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;
    
    return nodes.map((node, index) => {
      const angle = (index / nodes.length) * Math.PI * 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      
      return {
        ...node,
        x,
        y
      };
    });
  };

  // Position nodes
  const positionedNodes = calculateNodePositions();

  // Handle node selection
  const handleNodePress = (nodeId: string) => {
    setSelectedNode(selectedNode === nodeId ? null : nodeId);
    
    if (onSelectInsight) {
      const selectedInsight = insights.find(insight => insight.id === nodeId);
      if (selectedInsight) {
        onSelectInsight(selectedInsight);
      }
    }
  };

  // If no insights, show a message
  if (!insights || insights.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <ThemedText style={styles.emptyText}>
          No insights available yet. Continue chatting to build your profile.
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ThemedText style={styles.title}>Your Profile Network</ThemedText>
      <ThemedText style={styles.subtitle}>
        Circles represent insights discovered from your conversations.
        Connected insights may influence each other.
      </ThemedText>
      
      {/* SVG-like Canvas for Visualization */}
      <View style={styles.canvas}>
        {/* Draw connections first */}
        {connections.map((connection, index) => {
          const sourceNode = positionedNodes.find(node => node.id === connection.source);
          const targetNode = positionedNodes.find(node => node.id === connection.target);
          
          if (!sourceNode || !targetNode) return null;
          
          // Calculate line coordinates
          const lineStyle = {
            position: 'absolute',
            left: 0,
            top: 0,
            width: Math.sqrt(
              Math.pow(targetNode.x - sourceNode.x, 2) + 
              Math.pow(targetNode.y - sourceNode.y, 2)
            ),
            height: 2,
            backgroundColor: 'rgba(150,150,150,0.3)',
            transformOrigin: '0 0',
            transform: [
              { 
                translateX: sourceNode.x 
              },
              { 
                translateY: sourceNode.y 
              },
              { 
                rotate: `${Math.atan2(
                  targetNode.y - sourceNode.y, 
                  targetNode.x - sourceNode.x
                )}rad` 
              }
            ]
          };
          
          return (
            <View 
              key={`connection-${index}`} 
              style={[styles.connection, lineStyle as any]} 
            />
          );
        })}
        
        {/* Draw nodes on top */}
        {positionedNodes.map(node => (
          <TouchableOpacity
            key={`node-${node.id}`}
            style={[
              styles.node,
              {
                left: node.x - node.radius / 2,
                top: node.y - node.radius / 2,
                width: node.radius,
                height: node.radius,
                backgroundColor: node.color,
                borderWidth: selectedNode === node.id ? 3 : 0,
                borderColor: 'white'
              }
            ]}
            onPress={() => handleNodePress(node.id)}
          >
            {selectedNode === node.id && (
              <View style={styles.nodeLabel}>
                <ThemedText style={styles.nodeLabelText}>
                  {node.value.length > 15 ? node.value.substring(0, 15) + '...' : node.value}
                </ThemedText>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
      
      {/* Legend */}
      <View style={styles.legend}>
        {Array.from(new Set(nodes.map((node: any) => node.type))).map(type => (
          <View key={`legend-${type}`} style={styles.legendItem}>
            <View 
              style={[
                styles.legendDot, 
                { backgroundColor: getTypeColor(type as string) }
              ]} 
            />
            <ThemedText style={styles.legendText}>
              {formatType(type as string)}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 16,
    textAlign: 'center',
  },
  canvas: {
    height: 300,
    width: '100%',
    position: 'relative',
  },
  connection: {
    position: 'absolute',
    height: 2,
  },
  node: {
    position: 'absolute',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nodeLabel: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 4,
    borderRadius: 4,
    top: -30,
    minWidth: 80,
  },
  nodeLabelText: {
    color: 'white',
    fontSize: 10,
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 4,
  },
  legendText: {
    fontSize: 12,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.7,
  },
});

export default ProfileInsightsVisualization;