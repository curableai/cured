import { supabase } from '@/lib/supabaseClient';
import { useTheme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface DailyTip {
    icon: string;
    title: string;
    tip: string;
    category: string;
}

export default function DailyTipsCard() {
    const { colors } = useTheme();
    const [tips, setTips] = useState<DailyTip[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPersonalizedTips();
    }, []);

    const loadPersonalizedTips = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: onboarding } = await supabase
                .from('onboarding')
                .select('chronic_conditions, smoker, alcohol_drinker')
                .eq('user_id', user.id)
                .single();

            if (!onboarding) {
                setTips(getDefaultTips());
                return;
            }

            const personalizedTips = generatePersonalizedTips(
                onboarding.chronic_conditions || [],
                onboarding.smoker,
                onboarding.alcohol_drinker
            );

            setTips(personalizedTips);
        } catch (error) {
            console.error('Error loading tips:', error);
            setTips(getDefaultTips());
        } finally {
            setLoading(false);
        }
    };

    const generatePersonalizedTips = (
        conditions: string[],
        smoker: boolean,
        alcoholDrinker: boolean
    ): DailyTip[] => {
        const allTips: DailyTip[] = [];

        // Tips based on chronic conditions
        if (conditions.includes('diabetes') || conditions.includes('Diabetes')) {
            allTips.push({
                icon: '🍎',
                title: 'Blood Sugar Control',
                tip: 'Monitor your blood sugar levels regularly and maintain a balanced diet with complex carbs.',
                category: 'diabetes'
            });
        }

        if (conditions.includes('hypertension') || conditions.includes('Hypertension') || conditions.includes('high blood pressure')) {
            allTips.push({
                icon: '🧂',
                title: 'Reduce Sodium',
                tip: 'Limit salt intake to less than 2,300mg per day. Choose fresh foods over processed ones.',
                category: 'hypertension'
            });
        }

        if (conditions.includes('asthma') || conditions.includes('Asthma')) {
            allTips.push({
                icon: '🌬️',
                title: 'Breathing Exercise',
                tip: 'Practice deep breathing exercises daily. Keep your inhaler accessible at all times.',
                category: 'asthma'
            });
        }

        if (conditions.includes('arthritis') || conditions.includes('Arthritis')) {
            allTips.push({
                icon: '🧘',
                title: 'Joint Care',
                tip: 'Low-impact exercises like swimming or yoga can help maintain joint flexibility.',
                category: 'arthritis'
            });
        }

        if (conditions.includes('heart disease') || conditions.includes('Heart Disease')) {
            allTips.push({
                icon: '❤️',
                title: 'Heart Health',
                tip: 'Aim for 30 minutes of moderate exercise daily. Monitor your heart rate and blood pressure.',
                category: 'heart'
            });
        }

        // Lifestyle tips
        if (smoker) {
            allTips.push({
                icon: '🚭',
                title: 'Quit Smoking',
                tip: 'Consider nicotine replacement therapy or counseling. Every cigarette not smoked is a win.',
                category: 'smoking'
            });
        }

        if (alcoholDrinker) {
            allTips.push({
                icon: '💧',
                title: 'Moderate Alcohol',
                tip: 'Limit alcohol to 1-2 drinks per day. Stay hydrated with water between drinks.',
                category: 'alcohol'
            });
        }

        // General wellness tips
        allTips.push(
            {
                icon: '💤',
                title: 'Quality Sleep',
                tip: 'Aim for 7-9 hours of sleep. Keep a consistent sleep schedule, even on weekends.',
                category: 'sleep'
            },
            {
                icon: '🥗',
                title: 'Balanced Nutrition',
                tip: 'Fill half your plate with vegetables and fruits. Choose whole grains over refined ones.',
                category: 'nutrition'
            },
            {
                icon: '🚶',
                title: 'Stay Active',
                tip: 'Take short walking breaks every hour. Aim for 10,000 steps daily for optimal health.',
                category: 'activity'
            },
            {
                icon: '💧',
                title: 'Hydration',
                tip: 'Drink 8 glasses of water daily. Start your morning with a glass of water.',
                category: 'hydration'
            },
            {
                icon: '🧘',
                title: 'Stress Management',
                tip: 'Practice mindfulness or meditation for 10 minutes daily. Deep breathing helps reduce stress.',
                category: 'stress'
            }
        );

        // Shuffle and return 3 tips
        const shuffled = allTips.sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 3);
    };

    const getDefaultTips = (): DailyTip[] => {
        return [
            {
                icon: '💤',
                title: 'Quality Sleep',
                tip: 'Aim for 7-9 hours of sleep. Keep a consistent sleep schedule.',
                category: 'sleep'
            },
            {
                icon: '🥗',
                title: 'Balanced Nutrition',
                tip: 'Fill half your plate with vegetables and fruits.',
                category: 'nutrition'
            },
            {
                icon: '🚶',
                title: 'Stay Active',
                tip: 'Take short walking breaks every hour. Aim for 10,000 steps daily.',
                category: 'activity'
            }
        ];
    };

    if (loading || tips.length === 0) {
        return null;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Ionicons name="bulb" size={20} color={colors.primary} />
                <Text style={[styles.headerText, { color: colors.text }]}>Daily Health Tips</Text>
            </View>

            {tips.map((tip, index) => (
                <View
                    key={index}
                    style={[
                        styles.tipCard,
                        {
                            backgroundColor: colors.surface || 'rgba(255, 255, 255, 0.05)',
                            borderColor: 'rgba(255, 255, 255, 0.1)'
                        }
                    ]}
                >
                    <Text style={styles.icon}>{tip.icon}</Text>
                    <View style={styles.tipContent}>
                        <Text style={[styles.tipTitle, { color: colors.text }]}>{tip.title}</Text>
                        <Text style={[styles.tipText, { color: colors.textMuted }]}>{tip.tip}</Text>
                    </View>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    headerText: {
        fontSize: 16,
        fontWeight: '700',
    },
    tipCard: {
        flexDirection: 'row',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        gap: 12,
    },
    icon: {
        fontSize: 24,
    },
    tipContent: {
        flex: 1,
    },
    tipTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
    },
    tipText: {
        fontSize: 13,
        lineHeight: 18,
    },
});
