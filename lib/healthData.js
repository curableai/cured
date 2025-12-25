// lib/healthData.js
import AppleHealthKit from 'react-native-health';

/**
 * Fetch all key metrics from Apple HealthKit for the current user.
 */
export const fetchHealthData = (callback) => {
  const today = new Date().toISOString();

  const options = {
    startDate: new Date(2025, 0, 1).toISOString(), // You can adjust to user's start date
    endDate: today,
    ascending: false,
  };

  const data = {};

  // 1️⃣ Steps
  AppleHealthKit.getStepCount(options, (err, stepData) => {
    if (!err && stepData?.value) data.steps = stepData.value;

    // 2️⃣ Active Energy Burned
    AppleHealthKit.getActiveEnergyBurned(options, (err, res) => {
      if (!err && res?.value) data.activeEnergy = res.value;

      // 3️⃣ Resting Energy Burned
      AppleHealthKit.getBasalEnergyBurned(options, (err, res) => {
        if (!err && res?.value) data.restingEnergy = res.value;

        // 4️⃣ Walking Asymmetry
        AppleHealthKit.getWalkingAsymmetryPercentageSamples(options, (err, samples) => {
          if (!err && samples?.length)
            data.walkingAsymmetry = samples[0]?.value; // most recent

          // 5️⃣ Double Support Time
          AppleHealthKit.getWalkingDoubleSupportPercentageSamples(options, (err, samples) => {
            if (!err && samples?.length)
              data.doubleSupportTime = samples[0]?.value;

            // 6️⃣ Headphone Audio Level
            AppleHealthKit.getHeadphoneAudioExposureSamples(options, (err, samples) => {
              if (!err && samples?.length)
                data.headphoneAudioLevel = samples[0]?.value;

              // 7️⃣ Heart Rate
              AppleHealthKit.getHeartRateSamples(options, (err, samples) => {
                if (!err && samples?.length)
                  data.heartRate = samples[0]?.value; // latest reading

                // 8️⃣ Heart Rate Variability
                AppleHealthKit.getHeartRateVariabilitySamples(options, (err, samples) => {
                  if (!err && samples?.length)
                    data.heartRateVariability = samples[0]?.value;

                  // 9️⃣ Resting Heart Rate
                  AppleHealthKit.getRestingHeartRateSamples(options, (err, samples) => {
                    if (!err && samples?.length)
                      data.restingHeartRate = samples[0]?.value;

                    // 🔟 Walking Heart Rate Average
                    AppleHealthKit.getWalkingHeartRateAverage(options, (err, res) => {
                      if (!err && res?.value) data.walkingHeartRateAverage = res.value;

                      // 11️⃣ Sleep
                      AppleHealthKit.getSleepSamples(options, (err, samples) => {
                        if (!err && samples?.length) {
                          const latestSleep = samples[samples.length - 1];
                          data.sleep = {
                            start: latestSleep.startDate,
                            end: latestSleep.endDate,
                            durationHours:
                              (new Date(latestSleep.endDate) - new Date(latestSleep.startDate)) /
                              (1000 * 60 * 60),
                          };
                        }

                        // ✅ Finally return all metrics
                        console.log('Fetched Health Data:', data);
                        callback(data);
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
};
