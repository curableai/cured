import { create } from 'zustand';

interface AuthState {
    hasCompletedOnboarding: boolean;
    setHasCompletedOnboarding: (status: boolean) => void;
    hasAcceptedTerms: boolean;
    setHasAcceptedTerms: (status: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    hasCompletedOnboarding: false,
    setHasCompletedOnboarding: (status) => set({ hasCompletedOnboarding: status }),
    hasAcceptedTerms: false,
    setHasAcceptedTerms: (status) => set({ hasAcceptedTerms: status }),
}));
