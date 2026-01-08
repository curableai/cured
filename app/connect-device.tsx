import {
    checkHealthConnectAvailability,
    initializeHealthConnect,
    openHealthConnectStore,
    requestHealthConnectPermissions,
    SdkAvailabilityStatus
} from '@/lib/healthConnect';
import { requestHealthKitPermissions } from '@/lib/healthkitManager';
import { useTheme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';

const WATCH_BRANDS = [
    { id: 'oraimo', name: 'Oraimo', icon: 'watch-outline' },
    { id: 'apple', name: 'Apple Watch', icon: 'logo-apple' },
    { id: 'samsung', name: 'Samsung', icon: 'logo-android' },
    { id: 'xiaomi', name: 'Xiaomi', icon: 'watch-outline' },
    { id: 'pixel', name: 'Google Pixel', icon: 'logo-google' },
    { id: 'other', name: 'Other', icon: 'hardware-chip-outline' },
];

export default function ConnectDeviceScreen() {
    const router = useRouter();
    const { colors, isDark } = useTheme();

    const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
    const [sdkStatus, setSdkStatus] = useState<number | null>(null);
    const [checkingStatus, setCheckingStatus] = useState(false);
    const [hasBrandApp, setHasBrandApp] = useState(false);

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        setCheckingStatus(true);
        if (Platform.OS === 'android') {
            const status = await checkHealthConnectAvailability();
            setSdkStatus(status);
            if (status === SdkAvailabilityStatus.SDK_AVAILABLE) {
                await initializeHealthConnect();
            }
        }
        setCheckingStatus(false);
    };

    const handleConnect = async () => {
        if (Platform.OS === 'ios') {
            const success = await requestHealthKitPermissions(undefined, true);
            if (success) {
                Alert.alert("Success", "Apple Health connected! Your data will now sync.", [
                    { text: "OK", onPress: () => router.back() }
                ]);
            } else {
                Alert.alert("Permission Required", "We need permission to read your health data to provide insights.");
            }
            return;
        }

        if (Platform.OS !== 'android') {
            Alert.alert("Not Supported", "Health Connect is only available on Android. For iOS, we use Apple Health.");
            return;
        }

        if (sdkStatus !== null && (sdkStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE || sdkStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED)) {
            Alert.alert(
                "Install Health Connect",
                "To sync data from your watch, you need the Google Health Connect app. Tap below to install it from the Play Store.",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Install", onPress: openHealthConnectStore }
                ]
            );
            return;
        }

        const success = await requestHealthConnectPermissions();
        if (success) {
            Alert.alert("Success", "Permissions granted! Your data will now sync.", [
                { text: "OK", onPress: () => router.back() }
            ]);
        } else {
            Alert.alert("Permission Required", "We need permission to read your health data to provide insights.");
        }
    };

    const renderBrandGrid = () => (
        <View style={styles.grid}>
            {WATCH_BRANDS.map((brand) => (
                <Pressable
                    key={brand.id}
                    style={[
                        styles.brandCard,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                        selectedBrand === brand.id && { borderColor: colors.primary, backgroundColor: isDark ? 'rgba(29, 185, 84, 0.1)' : '#EFFDF5' }
                    ]}
                    onPress={() => setSelectedBrand(brand.id)}
                >
                    <Ionicons
                        name={brand.icon as any}
                        size={32}
                        color={selectedBrand === brand.id ? colors.primary : colors.textMuted}
                    />
                    <Text style={[
                        styles.brandName,
                        { color: colors.text },
                        selectedBrand === brand.id && { color: colors.primary, fontWeight: '700' }
                    ]}>
                        {brand.name}
                    </Text>
                    {selectedBrand === brand.id && (
                        <View style={styles.checkIcon}>
                            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                        </View>
                    )}
                </Pressable>
            ))}
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar style={isDark ? 'light' : 'dark'} />

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Connect Device</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Step 1: Select Brand */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>1. Select your watch</Text>
                    <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                        Which device are you using?
                    </Text>
                    {renderBrandGrid()}
                </View>

                {selectedBrand && (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>2. Setup Instructions</Text>

                        {/* Brand-specific instructions */}
                        {(selectedBrand === 'oraimo' || selectedBrand === 'xiaomi' || selectedBrand === 'other') ? (
                            <View style={[styles.infoCard, { backgroundColor: colors.surfaceElevated }]}>
                                <Ionicons name="bulb-outline" size={24} color="#F59E0B" style={{ marginBottom: 8 }} />
                                <Text style={[styles.infoText, { color: colors.text, fontWeight: '600' }]}>
                                    Budget Watch Setup (via Google Fit)
                                </Text>
                                <View style={styles.requirementList}>
                                    <View style={styles.reqItem}>
                                        <Text style={[styles.reqNumber, { color: colors.primary }]}>1.</Text>
                                        <Text style={[styles.reqText, { color: colors.text }]}>
                                            Open your watch app ({selectedBrand === 'oraimo' ? 'Oraimo Health' : selectedBrand === 'xiaomi' ? 'Zepp Life / Mi Fitness' : 'Your watch app'})
                                        </Text>
                                    </View>
                                    <View style={styles.reqItem}>
                                        <Text style={[styles.reqNumber, { color: colors.primary }]}>2.</Text>
                                        <Text style={[styles.reqText, { color: colors.text }]}>
                                            Go to Profile → Settings → Link with Google Fit
                                        </Text>
                                    </View>
                                    <View style={styles.reqItem}>
                                        <Text style={[styles.reqNumber, { color: colors.primary }]}>3.</Text>
                                        <Text style={[styles.reqText, { color: colors.text }]}>
                                            Open Google Fit → Profile → Settings → Manage connected apps → Enable Health Connect
                                        </Text>
                                    </View>
                                    <View style={styles.reqItem}>
                                        <Text style={[styles.reqNumber, { color: colors.primary }]}>4.</Text>
                                        <Text style={[styles.reqText, { color: colors.text }]}>
                                            Come back here and tap "Connect Health System"
                                        </Text>
                                    </View>
                                </View>
                                <Text style={[styles.noteText, { color: colors.textMuted }]}>
                                    Note: Data sync may take a few minutes after setup.
                                </Text>
                            </View>
                        ) : selectedBrand === 'apple' ? (
                            <View style={[styles.infoCard, { backgroundColor: colors.surfaceElevated }]}>
                                <Ionicons name="logo-apple" size={24} color={colors.text} style={{ marginBottom: 8 }} />
                                <Text style={[styles.infoText, { color: colors.text, fontWeight: '600' }]}>
                                    Apple Watch Setup
                                </Text>
                                <View style={styles.requirementList}>
                                    <View style={styles.reqItem}>
                                        <Text style={[styles.reqNumber, { color: colors.primary }]}>1.</Text>
                                        <Text style={[styles.reqText, { color: colors.text }]}>
                                            Ensure your Apple Watch is paired with your iPhone.
                                        </Text>
                                    </View>
                                    <View style={styles.reqItem}>
                                        <Text style={[styles.reqNumber, { color: colors.primary }]}>2.</Text>
                                        <Text style={[styles.reqText, { color: colors.text }]}>
                                            Tap "Connect Health System" below to allow Curable to read health data.
                                        </Text>
                                    </View>
                                    <View style={styles.reqItem}>
                                        <Text style={[styles.reqNumber, { color: colors.primary }]}>3.</Text>
                                        <Text style={[styles.reqText, { color: colors.text }]}>
                                            In the system prompt, enable all requested health categories.
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ) : (
                            <View style={[styles.infoCard, { backgroundColor: colors.surfaceElevated }]}>
                                <Ionicons name="information-circle-outline" size={24} color={colors.primary} style={{ marginBottom: 8 }} />
                                <Text style={[styles.infoText, { color: colors.text }]}>
                                    To sync your {WATCH_BRANDS.find(b => b.id === selectedBrand)?.name} watch:
                                </Text>
                                <View style={styles.requirementList}>
                                    <View style={styles.reqItem}>
                                        <Text style={[styles.reqNumber, { color: colors.textMuted }]}>1.</Text>
                                        <Text style={[styles.reqText, { color: colors.text }]}>
                                            Install the {WATCH_BRANDS.find(b => b.id === selectedBrand)?.name} app and pair your watch.
                                        </Text>
                                    </View>
                                    <View style={styles.reqItem}>
                                        <Text style={[styles.reqNumber, { color: colors.textMuted }]}>2.</Text>
                                        <Text style={[styles.reqText, { color: colors.text }]}>
                                            In the app's settings, enable "Health Connect" sync.
                                        </Text>
                                    </View>
                                    <View style={styles.reqItem}>
                                        <Text style={[styles.reqNumber, { color: colors.textMuted }]}>3.</Text>
                                        <Text style={[styles.reqText, { color: colors.text }]}>
                                            Return here and tap "Connect Health System".
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        <Pressable
                            style={[styles.checkboxRow, { borderColor: colors.border }]}
                            onPress={() => setHasBrandApp(!hasBrandApp)}
                        >
                            <View style={[styles.checkbox, hasBrandApp && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                                {hasBrandApp && <Ionicons name="checkmark" size={14} color="white" />}
                            </View>
                            <Text style={[styles.checkboxText, { color: colors.text }]}>
                                I've completed the setup steps above.
                            </Text>
                        </Pressable>
                    </View>
                )}
            </ScrollView>

            {/* Footer Action */}
            <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                {checkingStatus ? (
                    <ActivityIndicator color={colors.primary} />
                ) : (
                    <Pressable
                        style={[
                            styles.connectButton,
                            { backgroundColor: colors.primary },
                            (!selectedBrand || !hasBrandApp) && { opacity: 0.5 }
                        ]}
                        disabled={!selectedBrand || !hasBrandApp}
                        onPress={handleConnect}
                    >
                        <Text style={styles.connectButtonText}>
                            {sdkStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE || sdkStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED
                                ? "Download Health Connect"
                                : "Connect Health System"
                            }
                        </Text>
                    </Pressable>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
    },
    backButton: { padding: 4, marginRight: 12 },
    headerTitle: { fontSize: 20, fontWeight: '700' },
    content: { padding: 24, paddingBottom: 100 },
    section: { marginBottom: 32 },
    sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
    sectionSubtitle: { fontSize: 14, marginBottom: 20 },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    brandCard: {
        width: '31%', // roughly 3 columns
        aspectRatio: 1,
        borderRadius: 12,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 8,
        position: 'relative',
    },
    brandName: {
        marginTop: 8,
        fontSize: 12,
        textAlign: 'center',
        fontWeight: '500',
    },
    checkIcon: {
        position: 'absolute',
        top: 6,
        right: 6,
    },
    infoCard: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
    },
    infoText: {
        fontSize: 15,
        marginBottom: 12,
        lineHeight: 22,
    },
    requirementList: {
        gap: 8,
    },
    reqItem: { flexDirection: 'row', gap: 8 },
    reqNumber: { fontWeight: '700' },
    reqText: { flex: 1, fontSize: 14, lineHeight: 20 },
    noteText: {
        fontSize: 12,
        marginTop: 12,
        fontStyle: 'italic',
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#B3B3B3',
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 24,
        borderTopWidth: 1,
    },
    connectButton: {
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    connectButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});
