/**
 * Shared constants for Lennox iComfort API clients
 */

// ============================================================================
// HVAC Mode Constants
// ============================================================================

export const LENNOX_HVAC_OFF = 'off';
export const LENNOX_HVAC_HEAT = 'heat';
export const LENNOX_HVAC_COOL = 'cool';
export const LENNOX_HVAC_HEAT_COOL = 'heat and cool';
export const LENNOX_HVAC_EMERGENCY_HEAT = 'emergency heat';

// HomeKit HeatingCoolingState values
export enum HomekitHeatingCoolingState {
  OFF = 0,
  HEAT = 1,
  COOL = 2,
  AUTO = 3,
}

// Map Lennox modes to HomeKit modes
export const LENNOX_TO_HOMEKIT_MODE: Record<string, HomekitHeatingCoolingState> = {
  [LENNOX_HVAC_OFF]: HomekitHeatingCoolingState.OFF,
  [LENNOX_HVAC_HEAT]: HomekitHeatingCoolingState.HEAT,
  [LENNOX_HVAC_COOL]: HomekitHeatingCoolingState.COOL,
  [LENNOX_HVAC_HEAT_COOL]: HomekitHeatingCoolingState.AUTO,
  [LENNOX_HVAC_EMERGENCY_HEAT]: HomekitHeatingCoolingState.HEAT,
};

// Map HomeKit modes to Lennox modes
export const HOMEKIT_TO_LENNOX_MODE: Record<HomekitHeatingCoolingState, string> = {
  [HomekitHeatingCoolingState.OFF]: LENNOX_HVAC_OFF,
  [HomekitHeatingCoolingState.HEAT]: LENNOX_HVAC_HEAT,
  [HomekitHeatingCoolingState.COOL]: LENNOX_HVAC_COOL,
  [HomekitHeatingCoolingState.AUTO]: LENNOX_HVAC_HEAT_COOL,
};

// ============================================================================
// Temperature Operation States
// ============================================================================

export const LENNOX_TEMP_OPERATION_OFF = 'off';
export const LENNOX_TEMP_OPERATION_HEATING = 'heating';
export const LENNOX_TEMP_OPERATION_COOLING = 'cooling';
export const LENNOX_TEMP_OPERATION_WAITING = 'waiting';

// Map tempOperation to HomeKit CurrentHeatingCoolingState
export const TEMP_OPERATION_TO_HOMEKIT: Record<string, HomekitHeatingCoolingState> = {
  [LENNOX_TEMP_OPERATION_OFF]: HomekitHeatingCoolingState.OFF,
  [LENNOX_TEMP_OPERATION_HEATING]: HomekitHeatingCoolingState.HEAT,
  [LENNOX_TEMP_OPERATION_COOLING]: HomekitHeatingCoolingState.COOL,
  [LENNOX_TEMP_OPERATION_WAITING]: HomekitHeatingCoolingState.OFF, // Waiting = idle, maps to OFF
};

// ============================================================================
// Fan Mode Constants
// ============================================================================

export const LENNOX_FAN_AUTO = 'auto';
export const LENNOX_FAN_ON = 'on';
export const LENNOX_FAN_CIRCULATE = 'circulate';
