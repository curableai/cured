// ============================================================================
// CURABLE SIGNAL CAPTURE SERVICE V1.1 (Unified Architecture)
// ============================================================================
// Purpose: Capture and structure health facts for AI reasoning
// NOT for diagnosis, NOT for medical interpretation
// ============================================================================

import { supabase } from '@/lib/supabaseClient';
import * as Crypto from 'expo-crypto';
import {
    SignalDefinition as SchemaSignalDefinition,
    SIGNAL_REGISTRY,
    SignalContext,
    SignalSource,
    ValueType as SignalValueType
} from '../lib/signal_schema';

// ============================================================================
// TYPES (Derived from Schema where possible)
// ============================================================================

export type { SignalContext, SignalSource };
export type SafetyAlertLevel = 'normal' | 'caution' | 'extreme';
export type ProposalStatus = 'pending' | 'confirmed' | 'rejected' | 'edited';

export const SOURCE_CONFIDENCE: Record<SignalSource, number> = {
    device_healthkit: 0.95,
    device_health_connect: 0.95,
    onboarding: 0.9,
    daily_checkin: 0.8,
    chat_confirmed: 0.9,
    manual_input: 0.7
};

// Local Service Definition (Mapped from Schema for compatibility)
export interface SignalDefinition {
    signalId: string;
    name: string;
    description?: string;
    valueType: SignalValueType;
    defaultUnit?: string;
    allowedUnits: string[];
    isLongitudinal: boolean;
    allowedSources: SignalSource[];
    validationMin?: number;
    validationMax?: number;
    validationOptions?: string[];
    extremeMin?: number;
    extremeMax?: number;
}

// Local Instance Wrapper (extends Schema or maps to it)
// We use a simplified local version that matches the DB columns exactly
export interface SignalInstance {
    id: string;
    userId: string;
    signalId: string;
    value: number | boolean | string;
    unit?: string;
    source: SignalSource;
    confidence: number;
    capturedAt: string;
    createdBy: string;
    context: SignalContext;
    safetyAlertLevel: SafetyAlertLevel;
    requiresConfirmation: boolean;
    aiProposalId?: string;
    isActive: boolean;
    supersededAt?: string;
    supersededBy?: string;
    createdAt: string;
}

export interface AISignalProposal {
    id: string;
    userId: string;
    signalId: string;
    proposedValue: number | boolean | string;
    proposedUnit?: string;
    extractedFrom: string;
    extractionMethod?: string;
    aiConfidence: number;
    status: ProposalStatus;
    resolvedAt?: string;
    finalValue?: number | boolean | string;
    finalUnit?: string;
    createdAt: string;
}

export interface CaptureSignalParams {
    signalId: string;
    value: number | boolean | string;
    unit?: string;
    source: SignalSource;
    capturedAt?: string;
    context?: SignalContext;
    aiProposalId?: string;
    bypassConfirmation?: boolean;
}

export interface CaptureResult {
    success: boolean;
    instance?: SignalInstance;
    warning?: string;
    requiresConfirmation?: boolean;
    error?: string;
}

export interface TrendData {
    signalId: string;
    dataPoints: { value: number | boolean | string; capturedAt: string; confidence: number }[];
    days: number;
    lastUpdatedHoursAgo: number;
    from?: number;
    to?: number;
    change?: number;
    changePercent?: number;
    trueCount?: number;
    falseCount?: number;
    frequency?: number;
}

class SignalCaptureService {
    private db = supabase;

    // --------------------------------------------------------------------------
    // CAPTURE SIGNAL
    // --------------------------------------------------------------------------
    async captureSignal(params: CaptureSignalParams): Promise<CaptureResult> {
        try {
            const { data: { user }, error: authError } = await this.db.auth.getUser();
            if (authError || !user) return { success: false, error: 'User not authenticated' };

            const signalDef = await this.getSignalDefinition(params.signalId);
            if (!signalDef) return { success: false, error: `Unknown signal: ${params.signalId}` };

            // Source Validation
            if (!signalDef.allowedSources.includes(params.source)) {
                return { success: false, error: `Source '${params.source}' not allowed for ${signalDef.name}` };
            }

            // Unit Validation & Defaulting
            let captureUnit = params.unit;
            if (signalDef.valueType === 'numeric' && typeof params.value === 'number') {
                if (!captureUnit) {
                    if (signalDef.defaultUnit) {
                        captureUnit = signalDef.defaultUnit;
                    } else {
                        return { success: false, error: 'Unit is required for numeric signals' };
                    }
                } else if (!signalDef.allowedUnits.includes(captureUnit) && captureUnit !== signalDef.defaultUnit) {
                    return { success: false, error: `Invalid unit. Allowed: ${[signalDef.defaultUnit, ...signalDef.allowedUnits].filter(Boolean).join(', ')}` };
                }
            }

            // Value Validation
            const validationError = this.validateValue(params.value, signalDef);
            if (validationError) return { success: false, error: validationError };

            // Safety Check
            const safetyCheck = this.checkSafetyLevel(params.value, signalDef);
            if (safetyCheck.level === 'extreme' && !params.bypassConfirmation) {
                return { success: false, warning: safetyCheck.message, requiresConfirmation: true };
            }

            const confidence = SOURCE_CONFIDENCE[params.source] || 0.7;
            const now = new Date().toISOString();
            const newInstanceId = Crypto.randomUUID();

            // Handle Longitudinal vs Single-Point Logic
            // Signal ordering relies on captured_at (DB schema doesn't have is_active)

            // Insert Instance
            const { data, error } = await this.db.from('signal_instances')
                .insert({
                    id: newInstanceId,
                    user_id: user.id,
                    signal_id: params.signalId,
                    value: this.serializeValue(params.value),
                    unit: captureUnit ?? null,
                    source: params.source,
                    confidence,
                    captured_at: params.capturedAt ?? now,
                    created_by: 'user',
                    context: params.context ?? {},
                    safety_alert_level: safetyCheck.level,
                    requires_confirmation: safetyCheck.level === 'extreme',
                    ai_proposal_id: params.aiProposalId ?? null,
                    created_at: now,
                    updated_at: now,
                })
                .select()
                .single();

            if (error) return { success: false, error: error.message };

            // Auto-confirm AI proposal if linked
            if (params.aiProposalId) await this.confirmProposal(params.aiProposalId, params.value, params.unit);

            return {
                success: true,
                instance: this.mapToSignalInstance(data),
                warning: safetyCheck.level !== 'normal' ? safetyCheck.message : undefined,
            };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Failed to capture signal' };
        }
    }

    // --------------------------------------------------------------------------
    // GET LATEST ACTIVE SIGNAL
    // --------------------------------------------------------------------------
    async getSignalHistory(userId: string, signalId: string | 'all', limit: number = 30): Promise<SignalInstance[]> {
        let query = supabase
            .from('signal_instances')
            .select('*')
            .eq('user_id', userId)
            .order('captured_at', { ascending: false })
            .limit(limit);

        if (signalId !== 'all') {
            query = query.eq('signal_id', signalId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching signal history:', error);
            return [];
        }

        return (data || []).map(row => this.mapToSignalInstance(row));
    }

    async getLatestSignal(userId: string, signalId: string): Promise<SignalInstance | null> {
        try {
            const { data, error } = await this.db.from('signal_instances')
                .select('*')
                .eq('user_id', userId)
                .eq('signal_id', signalId)
                .order('captured_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (error) return null;
            return data ? this.mapToSignalInstance(data) : null;
        } catch {
            return null;
        }
    }



    // --------------------------------------------------------------------------
    // COMPUTE TREND
    // --------------------------------------------------------------------------
    async computeTrend(userId: string, signalId: string, days: number = 30): Promise<TrendData | null> {
        try {
            const history = await this.getSignalHistory(userId, signalId, days);
            if (history.length < 2) return null;

            const signalDef = await this.getSignalDefinition(signalId);
            if (!signalDef) return null;

            const latest = history[0];
            const hoursAgo = (Date.now() - new Date(latest.capturedAt).getTime()) / (1000 * 60 * 60);

            const trendData: TrendData = {
                signalId,
                dataPoints: history.map(h => ({ value: h.value, capturedAt: h.capturedAt, confidence: h.confidence })),
                days,
                lastUpdatedHoursAgo: Math.round(hoursAgo),
            };

            if (signalDef.valueType === 'numeric') {
                const numericValues = history.filter(h => typeof h.value === 'number').map(h => h.value as number);
                if (numericValues.length >= 2) {
                    const newest = numericValues[0];
                    const oldest = numericValues[numericValues.length - 1];
                    trendData.from = oldest;
                    trendData.to = newest;
                    trendData.change = newest - oldest;
                    trendData.changePercent = oldest !== 0 ? ((newest - oldest) / oldest) * 100 : 0;
                }
            }

            if (signalDef.valueType === 'boolean') {
                const boolValues = history.filter(h => typeof h.value === 'boolean');
                const trueCount = boolValues.filter(h => h.value === true).length;
                trendData.trueCount = trueCount;
                trendData.falseCount = boolValues.length - trueCount;
                trendData.frequency = trueCount / boolValues.length;
            }

            return trendData;
        } catch {
            return null;
        }
    }

    // --------------------------------------------------------------------------
    // AI PROPOSAL MANAGEMENT
    // --------------------------------------------------------------------------
    async createProposal(
        userId: string,
        signalId: string,
        proposedValue: number | boolean | string,
        proposedUnit: string | undefined,
        extractedFrom: string,
        aiConfidence: number,
        extractionMethod?: string
    ): Promise<AISignalProposal | null> {
        if (aiConfidence < 0 || aiConfidence > 1) return null;

        try {
            const now = new Date().toISOString();
            const { data, error } = await this.db.from('ai_signal_proposals')
                .insert({
                    id: Crypto.randomUUID(),
                    user_id: userId,
                    signal_id: signalId,
                    proposed_value: this.serializeValue(proposedValue),
                    proposed_unit: proposedUnit ?? null,
                    extracted_from: extractedFrom,
                    extraction_method: extractionMethod ?? null,
                    ai_confidence: aiConfidence,
                    status: 'pending',
                    created_at: now,
                    updated_at: now,
                })
                .select()
                .single();

            if (error) return null;
            return this.mapToProposal(data);
        } catch {
            return null;
        }
    }

    async confirmProposal(proposalId: string, finalValue?: number | boolean | string, finalUnit?: string): Promise<boolean> {
        try {
            const { error } = await this.db.from('ai_signal_proposals')
                .update({ status: 'confirmed', resolved_at: new Date().toISOString(), final_value: finalValue ? this.serializeValue(finalValue) : null, final_unit: finalUnit ?? null })
                .eq('id', proposalId);
            return !error;
        } catch {
            return false;
        }
    }

    async rejectProposal(proposalId: string): Promise<boolean> {
        try {
            const { error } = await this.db.from('ai_signal_proposals')
                .update({ status: 'rejected', resolved_at: new Date().toISOString() })
                .eq('id', proposalId);
            return !error;
        } catch {
            return false;
        }
    }

    async getPendingProposals(userId: string): Promise<AISignalProposal[]> {
        try {
            const { data, error } = await this.db.from('ai_signal_proposals')
                .select('*')
                .eq('user_id', userId)
                .eq('status', 'pending')
                .order('created_at', { ascending: false });
            return (data ?? []).map(row => this.mapToProposal(row));
        } catch {
            return [];
        }
    }

    // --------------------------------------------------------------------------
    // SIGNAL DEFINITION MANAGEMENT (STATIC SCHEMA)
    // --------------------------------------------------------------------------
    async getSignalDefinition(signalId: string): Promise<SignalDefinition | null> {
        const rawDef = SIGNAL_REGISTRY.find(s => s.id === signalId);
        if (!rawDef) return null;
        return this.mapToServiceDefinition(rawDef);
    }

    async getAllSignalDefinitions(): Promise<SignalDefinition[]> {
        return SIGNAL_REGISTRY.map(s => this.mapToServiceDefinition(s));
    }

    // --------------------------------------------------------------------------
    // PRIVATE HELPERS
    // --------------------------------------------------------------------------
    private mapToServiceDefinition(raw: SchemaSignalDefinition): SignalDefinition {
        return {
            signalId: raw.id,
            name: raw.name,
            description: undefined, // Description is not in V4 schema explicitly
            valueType: (raw.valueType === 'severity' || raw.valueType === 'time')
                ? 'numeric'
                : (raw.valueType as SignalValueType),
            defaultUnit: raw.unit,
            allowedUnits: raw.unit ? [raw.unit] : [],
            isLongitudinal: raw.trackTrend ?? false,
            allowedSources: raw.allowedSources,
            validationMin: raw.validation?.min,
            validationMax: raw.validation?.max,
            validationOptions: raw.validation?.options,
            // Schema currently handles extreme values differently, keeping undefined for now
            extremeMin: undefined,
            extremeMax: undefined,
        };
    }

    private validateValue(value: any, def: SignalDefinition): string | null {
        if (def.valueType === 'numeric' && typeof value !== 'number') return 'Value must be a number';
        if (def.valueType === 'boolean' && typeof value !== 'boolean') return 'Value must be boolean';

        if (typeof value === 'number') {
            if (def.validationMin !== undefined && value < def.validationMin) return `Value below minimum (${def.validationMin})`;
            if (def.validationMax !== undefined && value > def.validationMax) return `Value above maximum (${def.validationMax})`;
        }

        if (def.valueType === 'categorical' && def.validationOptions) {
            if (!def.validationOptions.includes(value)) return `Invalid option. Allowed: ${def.validationOptions.join(', ')}`;
        }

        return null;
    }

    private checkSafetyLevel(value: any, def: SignalDefinition): { level: SafetyAlertLevel; message?: string } {
        if (typeof value === 'number') {
            if (def.extremeMin !== undefined && value < def.extremeMin) return { level: 'extreme', message: 'Medical emergency level detected' };
            if (def.extremeMax !== undefined && value > def.extremeMax) return { level: 'extreme', message: 'Medical emergency level detected' };
        }
        return { level: 'normal' };
    }

    private serializeValue(value: any): any {
        if (typeof value === 'boolean') return value ? 1 : 0;
        return value;
    }

    private mapToSignalInstance(row: any): SignalInstance {
        let val: any = row.value;
        // Basic deserialization (if Supabase returns different types)
        if (row.value === 'true') val = true;
        if (row.value === 'false') val = false;

        return {
            id: row.id,
            userId: row.user_id,
            signalId: row.signal_id,
            value: val,
            unit: row.unit,
            source: row.source,
            confidence: row.confidence,
            capturedAt: row.captured_at,
            createdBy: row.created_by,
            context: row.context,
            safetyAlertLevel: row.safety_alert_level as SafetyAlertLevel,
            requiresConfirmation: row.requires_confirmation,
            aiProposalId: row.ai_proposal_id,
            isActive: row.is_active,
            supersededAt: row.superseded_at,
            supersededBy: row.superseded_by,
            createdAt: row.created_at,
        };
    }

    private mapToProposal(row: any): AISignalProposal {
        let val: any = row.proposed_value;
        if (row.proposed_value === 'true') val = true;
        if (row.proposed_value === 'false') val = false;

        return {
            id: row.id,
            userId: row.user_id,
            signalId: row.signal_id,
            proposedValue: val,
            proposedUnit: row.proposed_unit,
            extractedFrom: row.extracted_from,
            extractionMethod: row.extraction_method,
            aiConfidence: row.ai_confidence,
            status: row.status,
            createdAt: row.created_at,
            resolvedAt: row.resolved_at,
            finalValue: row.final_value,
            finalUnit: row.final_unit
        };
    }
}

export const clinicalSignalService = new SignalCaptureService();