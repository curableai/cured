-- Migration for Clinical Signal Capture Service

-- 1. ENUMS and TYPES
DO $$ BEGIN
    CREATE TYPE signal_data_type AS ENUM ('objective', 'subjective', 'derived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE clinical_signal_value_type AS ENUM ('numeric', 'boolean', 'categorical', 'severity', 'text');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE safety_alert_level AS ENUM ('info', 'caution', 'urgent', 'emergency');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE clinical_direction AS ENUM ('higher_is_better', 'lower_is_better', 'u_shaped', 'neutral');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. SIGNAL DEFINITIONS
CREATE TABLE IF NOT EXISTS signal_definitions (
    signal_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    data_type signal_data_type NOT NULL,
    is_longitudinal BOOLEAN NOT NULL DEFAULT true,
    value_type clinical_signal_value_type NOT NULL,
    default_unit TEXT NOT NULL,
    allowed_units TEXT[] NOT NULL DEFAULT '{}',
    clinical_direction clinical_direction NOT NULL DEFAULT 'neutral',
    trend_significance_threshold NUMERIC NOT NULL DEFAULT 0.0,
    freshness_stable_hours INTEGER NOT NULL DEFAULT 24,
    freshness_monitoring_hours INTEGER NOT NULL DEFAULT 6,
    freshness_acute_hours INTEGER NOT NULL DEFAULT 1,
    allowed_sources TEXT[] NOT NULL DEFAULT '{}',
    requires_clinical_context BOOLEAN NOT NULL DEFAULT false,
    requires_fasting_status BOOLEAN NOT NULL DEFAULT false,
    disclaimer_text TEXT,
    validation JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SAFETY THRESHOLDS
CREATE TABLE IF NOT EXISTS safety_thresholds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id TEXT REFERENCES signal_definitions(signal_id) ON DELETE CASCADE,
    unit TEXT NOT NULL,
    normal_range_min NUMERIC,
    normal_range_max NUMERIC,
    critical_low NUMERIC,
    critical_high NUMERIC,
    urgent_low NUMERIC,
    urgent_high NUMERIC,
    thresholds_by_context JSONB DEFAULT '[]',
    requires_immediate_action_if_critical BOOLEAN DEFAULT false,
    recommended_action_text TEXT,
    emergency_contact_info TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. DISCLAIMER ACCEPTANCES
CREATE TABLE IF NOT EXISTS disclaimer_acceptances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    disclaimer_type TEXT NOT NULL,
    disclaimer_version TEXT NOT NULL,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. SIGNAL INSTANCES
CREATE TABLE IF NOT EXISTS signal_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    signal_id TEXT REFERENCES signal_definitions(signal_id) ON DELETE RESTRICT,
    value JSONB NOT NULL,
    unit TEXT NOT NULL,
    data_type signal_data_type NOT NULL,
    source TEXT NOT NULL,
    source_reliability NUMERIC NOT NULL CHECK (source_reliability >= 0 AND source_reliability <= 1),
    measurement_quality NUMERIC CHECK (measurement_quality >= 0 AND measurement_quality <= 1),
    temporal_relevance NUMERIC CHECK (temporal_relevance >= 0 AND temporal_relevance <= 1),
    measurement_context JSONB DEFAULT '{}',
    patient_context JSONB DEFAULT '{}',
    captured_at TIMESTAMPTZ NOT NULL,
    is_within_normal_range BOOLEAN,
    safety_alert_level safety_alert_level,
    requires_immediate_action BOOLEAN DEFAULT false,
    clinical_notes TEXT,
    ai_proposal_id UUID,
    user_understanding_confirmed BOOLEAN DEFAULT false,
    superseded_by UUID REFERENCES signal_instances(id),
    superseded_at TIMESTAMPTZ,
    supersede_reason TEXT,
    recorded_by TEXT DEFAULT 'patient',
    disclaimer_shown BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. AI SIGNAL PROPOSALS
CREATE TABLE IF NOT EXISTS ai_signal_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    signal_id TEXT REFERENCES signal_definitions(signal_id) ON DELETE CASCADE,
    proposed_value JSONB NOT NULL,
    proposed_unit TEXT NOT NULL,
    extracted_from TEXT NOT NULL,
    extraction_method TEXT,
    ai_confidence NUMERIC NOT NULL CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
    status TEXT CHECK (status IN ('pending', 'confirmed', 'rejected', 'expired')),
    user_reviewed_details BOOLEAN DEFAULT false,
    user_modified_value BOOLEAN DEFAULT false,
    clinician_verified BOOLEAN DEFAULT false,
    verification_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. RPC: evaluate_safety_threshold
CREATE OR REPLACE FUNCTION evaluate_safety_threshold(
    p_signal_id TEXT,
    p_value NUMERIC,
    p_patient_context JSONB
)
RETURNS TABLE (
    "isSafe" BOOLEAN,
    "alertLevel" safety_alert_level,
    "requiresAction" BOOLEAN,
    "message" TEXT
) AS $$
DECLARE
    v_thresholds safety_thresholds%ROWTYPE;
    v_alert_level safety_alert_level := 'info';
    v_is_safe BOOLEAN := true;
    v_requires_action BOOLEAN := false;
    v_message TEXT := 'Value is within normal range';
BEGIN
    -- Get thresholds for the signal
    SELECT * INTO v_thresholds FROM safety_thresholds WHERE signal_id = p_signal_id LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT true, 'info'::safety_alert_level, false, 'No thresholds defined';
        RETURN;
    END IF;

    -- Basic check against numeric ranges (ignoring complex context for MVP)
    -- Critical checks first
    IF (v_thresholds.critical_low IS NOT NULL AND p_value <= v_thresholds.critical_low) OR
       (v_thresholds.critical_high IS NOT NULL AND p_value >= v_thresholds.critical_high) THEN
       
        v_alert_level := 'emergency';
        v_is_safe := false;
        v_requires_action := true;
        v_message := COALESCE(v_thresholds.recommended_action_text, 'Critical value detected. Seek immediate medical attention.');
        
    ELSIF (v_thresholds.urgent_low IS NOT NULL AND p_value <= v_thresholds.urgent_low) OR
          (v_thresholds.urgent_high IS NOT NULL AND p_value >= v_thresholds.urgent_high) THEN
          
        v_alert_level := 'urgent';
        v_is_safe := false;
        v_requires_action := true;
        v_message := COALESCE(v_thresholds.recommended_action_text, 'Urgent value detected. Please consult a clinician.');

    ELSIF (v_thresholds.normal_range_min IS NOT NULL AND p_value < v_thresholds.normal_range_min) OR
          (v_thresholds.normal_range_max IS NOT NULL AND p_value > v_thresholds.normal_range_max) THEN
          
        v_alert_level := 'caution';
        v_is_safe := false;
        v_requires_action := false;
        v_message := 'Value is outside normal range.';
        
    END IF;

    RETURN QUERY SELECT v_is_safe, v_alert_level, v_requires_action, v_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RLS POLICIES
ALTER TABLE signal_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON signal_definitions FOR SELECT USING (true);

ALTER TABLE safety_thresholds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON safety_thresholds FOR SELECT USING (true);

ALTER TABLE disclaimer_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own acceptance" ON disclaimer_acceptances FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own acceptance" ON disclaimer_acceptances FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE signal_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own signals" ON signal_instances FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own signals" ON signal_instances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own signals" ON signal_instances FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE ai_signal_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can crud own proposals" ON ai_signal_proposals FOR ALL USING (auth.uid() = user_id);

-- 9. SEED DATA - SIGNAL REGISTRY

-- VITALS
INSERT INTO signal_definitions (signal_id, name, data_type, value_type, default_unit, allowed_units, clinical_direction, trend_significance_threshold, allowed_sources, validation, freshness_stable_hours)
VALUES 
('heart_rate', 'Heart Rate', 'objective', 'numeric', 'bpm', '{bpm}', 'u_shaped', 10.0, '{device_healthkit,device_health_connect,manual_input,chat_confirmed}', '{"min": 40, "max": 200}', 24),
('blood_pressure_systolic', 'Systolic Blood Pressure', 'objective', 'numeric', 'mmHg', '{mmHg}', 'lower_is_better', 5.0, '{device_healthkit,device_health_connect,manual_input,chat_confirmed}', '{"min": 70, "max": 200}', 168),
('blood_oxygen', 'Blood Oxygen', 'objective', 'numeric', '%', '{%}', 'higher_is_better', 2.0, '{device_healthkit,device_health_connect}', '{"min": 70, "max": 100}', 24),
('weight', 'Weight', 'objective', 'numeric', 'kg', '{kg,lbs}', 'u_shaped', 3.0, '{device_healthkit,device_health_connect,manual_input,chat_confirmed,onboarding}', '{"min": 30, "max": 300}', 168),
('height', 'Height', 'objective', 'numeric', 'cm', '{cm,feet}', 'neutral', 0.1, '{manual_input,onboarding}', '{"min": 50, "max": 250}', 999999),
('body_temperature', 'Body Temperature', 'objective', 'numeric', '°C', '{°C,°F}', 'u_shaped', 1.0, '{manual_input,device_healthkit,device_health_connect,chat_confirmed}', '{"min": 35, "max": 42}', 12)
ON CONFLICT (signal_id) DO UPDATE SET 
    name = EXCLUDED.name, allowed_sources = EXCLUDED.allowed_sources, validation = EXCLUDED.validation;

-- SYMPTOMS
INSERT INTO signal_definitions (signal_id, name, data_type, value_type, default_unit, allowed_units, clinical_direction, allowed_sources, validation, freshness_stable_hours)
VALUES 
('headache', 'Headache', 'subjective', 'severity', 'severity_1_10', '{severity_1_10}', 'lower_is_better', '{manual_input,chat_confirmed,daily_checkin}', '{"min": 1, "max": 10}', 12),
('fever', 'Fever', 'subjective', 'boolean', 'boolean', '{boolean}', 'lower_is_better', '{manual_input,chat_confirmed,daily_checkin}', '{}', 12),
('fatigue', 'Fatigue', 'subjective', 'severity', 'severity_1_10', '{severity_1_10}', 'lower_is_better', '{manual_input,chat_confirmed,daily_checkin}', '{"min": 1, "max": 10}', 24),
('cough', 'Cough', 'subjective', 'categorical', 'n/a', '{n/a}', 'neutral', '{manual_input,chat_confirmed,daily_checkin}', '{"options": ["none", "dry", "wet", "severe"]}', 24),
('nausea', 'Nausea', 'subjective', 'severity', 'severity_1_10', '{severity_1_10}', 'lower_is_better', '{manual_input,chat_confirmed,daily_checkin}', '{"min": 1, "max": 10}', 12),
('chest_pain', 'Chest Pain', 'subjective', 'severity', 'severity_1_10', '{severity_1_10}', 'lower_is_better', '{manual_input,chat_confirmed}', '{"min": 1, "max": 10}', 1),
('difficulty_breathing', 'Difficulty Breathing', 'subjective', 'severity', 'severity_1_10', '{severity_1_10}', 'lower_is_better', '{manual_input,chat_confirmed}', '{"min": 1, "max": 10}', 1)
ON CONFLICT (signal_id) DO NOTHING;

-- LIFESTYLE
INSERT INTO signal_definitions (signal_id, name, data_type, value_type, default_unit, allowed_units, clinical_direction, allowed_sources, validation, freshness_stable_hours)
VALUES 
('sleep_duration', 'Sleep Duration', 'subjective', 'numeric', 'hours', '{hours}', 'u_shaped', '{onboarding,daily_checkin,chat_confirmed,device_healthkit,device_health_connect}', '{"min": 0, "max": 16}', 24),
('water_intake', 'Water Intake', 'subjective', 'numeric', 'bottles', '{bottles,glasses,ml}', 'higher_is_better', '{onboarding,daily_checkin,chat_confirmed,device_healthkit,device_health_connect}', '{"min": 0, "max": 15}', 24),
('stress_level', 'Stress Level', 'subjective', 'categorical', 'n/a', '{n/a}', 'lower_is_better', '{onboarding,daily_checkin,chat_confirmed}', '{"options": ["low", "moderate", "high", "overwhelming"]}', 24),
('physical_activity', 'Physical Activity', 'subjective', 'categorical', 'n/a', '{n/a}', 'higher_is_better', '{onboarding,daily_checkin,chat_confirmed,device_healthkit,device_health_connect}', '{"options": ["none", "light", "moderate", "intense"]}', 24),
('steps_count', 'Steps Count', 'objective', 'numeric', 'steps', '{steps}', 'higher_is_better', '{device_healthkit,device_health_connect}', '{"min": 0, "max": 50000}', 24)
ON CONFLICT (signal_id) DO NOTHING;

-- MENTAL
INSERT INTO signal_definitions (signal_id, name, data_type, value_type, default_unit, allowed_units, clinical_direction, allowed_sources, validation, freshness_stable_hours)
VALUES 
('mood', 'Mood', 'subjective', 'categorical', 'n/a', '{n/a}', 'higher_is_better', '{daily_checkin,chat_confirmed}', '{"options": ["very_low", "low", "neutral", "good", "great"]}', 24),
('anxiety_level', 'Anxiety Level', 'subjective', 'categorical', 'n/a', '{n/a}', 'lower_is_better', '{daily_checkin,chat_confirmed}', '{"options": ["none", "mild", "moderate", "severe"]}', 24)
ON CONFLICT (signal_id) DO NOTHING;

-- CONTEXT
INSERT INTO signal_definitions (signal_id, name, data_type, value_type, default_unit, allowed_units, clinical_direction, allowed_sources, validation, freshness_stable_hours, is_longitudinal)
VALUES 
('age', 'Age', 'objective', 'numeric', 'years', '{years}', 'neutral', '{onboarding,manual_input}', '{"min": 1, "max": 120}', 999999, false),
('sex', 'Biological Sex', 'objective', 'categorical', 'n/a', '{n/a}', 'neutral', '{onboarding}', '{"options": ["male", "female"]}', 999999, false),
('pregnancy_status', 'Pregnancy Status', 'objective', 'categorical', 'n/a', '{n/a}', 'neutral', '{onboarding,chat_confirmed}', '{"options": ["not_pregnant", "pregnant", "trying_to_conceive", "postpartum", "unsure"]}', 999999, false),
('chronic_condition', 'Chronic Condition', 'objective', 'categorical', 'n/a', '{n/a}', 'neutral', '{onboarding,chat_confirmed}', '{"options": ["hypertension", "diabetes", "asthma", "arthritis", "heart_disease", "kidney_disease", "none"]}', 999999, false)
ON CONFLICT (signal_id) DO NOTHING;

-- 10. SEED DATA - SAFETY THRESHOLDS (Basic)
INSERT INTO safety_thresholds (signal_id, unit, normal_range_min, normal_range_max, critical_high, critical_low, urgent_high, urgent_low, recommended_action_text)
VALUES 
('heart_rate', 'bpm', 60, 100, 180, 30, 120, 40, 'Heart rate is critically abnormal.'),
('blood_pressure_systolic', 'mmHg', 90, 120, 180, 70, 140, 80, 'Blood pressure is critically high.'),
('blood_oxygen', '%', 95, 100, null, 88, null, 92, 'Blood oxygen is dangerously low.'),
('body_temperature', '°C', 36.1, 37.2, 40.0, 35.0, 39.0, null, 'High fever detected.')
ON CONFLICT DO NOTHING;
