/** Set when the device has no speech voice for a language the app needed. */
export const voiceStatus = $state<{ missing: string | null }>({ missing: null });
