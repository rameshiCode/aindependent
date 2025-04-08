// frontend-rn/utils/profileDataManager.ts
import { UserProfile, UserInsight, UserGoal } from '../hooks/useProfile';

/**
 * Helper class to manage and format profile data to avoid TS errors
 * and provide consistent data access
 */
export class ProfileDataManager {
  private profile: UserProfile | null;
  private insights: UserInsight[];
  private goals: UserGoal[];

  constructor(profile: UserProfile | null, insights: UserInsight[] = [], goals: UserGoal[] = []) {
    this.profile = profile;
    this.insights = insights || [];
    this.goals = goals || [];
  }

  /**
   * Get the addiction type
   */
  getAddictionType(): string {
    if (!this.profile) return 'Not identified yet';

    // First check profile's addiction_type
    if (this.profile.addiction_type) {
      return this.formatValue(this.profile.addiction_type);
    }

    // Then check insights
    const insight = this.getInsightByType('addiction_type');
    if (insight) {
      return this.formatValue(insight.value);
    }

    return 'Not identified yet';
  }

  /**
   * Get the motivation level (1-10)
   */
  getMotivationLevel(): number | null {
    if (!this.profile) return null;

    // First check profile
    if (this.profile.motivation_level !== null && this.profile.motivation_level !== undefined) {
      return this.profile.motivation_level;
    }

    // Then check insights
    const insight = this.getInsightByType('motivation');
    if (insight && insight.value) {
      // Try to extract a number from the value string
      const match = insight.value.match(/\d+/);
      if (match) {
        return parseInt(match[0], 10);
      }
    }

    return null;
  }

  /**
   * Get the recovery stage
   */
  getRecoveryStage(): string | null {
    if (!this.profile) return null;

    // First check profile
    if (this.profile.recovery_stage) {
      return this.profile.recovery_stage;
    }

    // Then check insights
    const insight = this.getInsightByType('recovery_stage');
    if (insight && insight.value) {
      return insight.value;
    }

    return null;
  }

  /**
   * Get formatted recovery stage name
   */
  getFormattedRecoveryStage(): string {
    const stage = this.getRecoveryStage();
    if (!stage) return 'Not determined yet';

    return this.formatValue(stage);
  }

  /**
   * Get abstinence days
   */
  getAbstinenceDays(): number | null {
    if (!this.profile) return null;
    return this.profile.abstinence_days;
  }

  /**
   * Get psychological traits (true values only)
   */
  getPsychologicalTraits(): string[] {
    const traits: string[] = [];

    // Get all psychological_trait insights
    const traitInsights = this.getInsightsByType('psychological_trait');

    // Extract trait names where value is "true"
    traitInsights.forEach(insight => {
      if (!insight.value) return;

      const parts = insight.value.split(':');
      if (parts.length === 2) {
        const [trait, value] = parts;
        if (value.toLowerCase() === 'true') {
          traits.push(this.formatValue(trait.replace(/_/g, ' ')));
        }
      }
    });

    return traits;
  }

  /**
   * Get triggers by type
   */
  getTriggers(): UserInsight[] {
    return this.getInsightsByType('trigger');
  }

  /**
   * Get all active goals
   */
  getActiveGoals(): UserGoal[] {
    return this.goals.filter(goal => goal.status === 'active');
  }

  /**
   * Helper: Get insight by type (returns first matching insight)
   */
  getInsightByType(type: string): UserInsight | null {
    if (!this.insights || this.insights.length === 0) return null;

    // First try exact match
    const exactMatch = this.insights.find(insight => insight.type === type);
    if (exactMatch) return exactMatch;

    // Also try insight_type
    return this.insights.find(insight => {
      // @ts-ignore - handle possibly undefined insight_type
      return insight.insight_type === type;
    }) || null;
  }

  /**
   * Helper: Get all insights by type
   */
  getInsightsByType(type: string): UserInsight[] {
    if (!this.insights || this.insights.length === 0) return [];

    // Gather all matching insights, checking both type and insight_type fields
    return this.insights.filter(insight => {
      return insight.type === type ||
             // @ts-ignore - handle possibly undefined insight_type
             insight.insight_type === type;
    });
  }

  /**
   * Helper: Format display value (capitalize first letter)
   */
  formatValue(value: string): string {
    if (!value) return '';
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
