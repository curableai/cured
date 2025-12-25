// lib/disclaimer.ts

export const CURABLE_DISCLAIMER_VERSION = "1.0";
export const CURABLE_DISCLAIMER_TYPE = "app_usage";

export const CURABLE_DISCLAIMER_CONTENT = `
# Welcome to Curable

Your personal health advisory companion. Please read carefully before using the app:

## 1. Advisory Guidance Only
Curable provides **advisory guidance only** based on information you provide. It is not a medical diagnosis, treatment plan, or prescription.

## 2. AI-Generated Suggestions
The app uses AI to generate personalized suggestions, but it does **not replace professional medical advice**.

## 3. Consult Healthcare Professionals
Always consult a qualified healthcare professional for serious, persistent, or unusual symptoms.

## 4. Extreme Value Flagging
Any extreme or concerning results flagged by the AI are for informational purposes and should prompt contacting a professional immediately.

## 5. No Liability for Health Decisions
By using Curable, you acknowledge that the app is **not responsible for any health decisions** made based on the information provided.

## 6. Data Accuracy Responsibility
Keep your profile and uploaded data accurate to get the best guidance. You are responsible for entering correct information.

## 7. ⚠️ EXTREME VALUE WARNING
If Curable flags a value as "extreme" (red warning), you **must seek medical attention immediately**. Curable is NOT liable for consequences of delayed care when extreme values are flagged.

## 8. Data Accuracy
You are responsible for entering accurate information. Incorrect data leads to incorrect guidance.

## 9. NO EMERGENCY USE
**Do NOT use Curable for medical emergencies.** 

Call emergency services or go to a hospital immediately if experiencing:
- Chest pain or pressure
- Difficulty breathing or shortness of breath
- Severe bleeding that won't stop
- Sudden confusion or difficulty speaking
- Loss of consciousness or fainting
- Severe allergic reactions
- Seizures
- Suspected stroke symptoms

## Your Acceptance
By clicking "I Accept and Understand" below, you confirm that:
- You have read and understood this disclaimer
- You accept full responsibility for your health decisions
- You understand Curable is advisory, not diagnostic
- You will seek professional medical care when needed
- You accept the terms and limitations described above
`;

export const DISCLAIMER_EMERGENCY_LIST = [
    "Chest pain or pressure",
    "Difficulty breathing",
    "Severe bleeding",
    "Sudden confusion",
    "Loss of consciousness",
    "Severe allergic reactions",
    "Seizures",
    "Suspected stroke"
];
