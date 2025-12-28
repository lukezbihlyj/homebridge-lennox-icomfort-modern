/**
 * Constants for Lennox S30/S40/E30/M30 Cloud API
 */

// ============================================================================
// API Endpoints - Cloud
// ============================================================================

export const CLOUD_AUTHENTICATE_URL = 'https://ic3messaging.myicomfort.com/v1/mobile/authenticate';
export const CLOUD_LOGIN_URL = 'https://ic3messaging.myicomfort.com/v2/user/login';
export const CLOUD_NEGOTIATE_URL = 'https://icnotificationservice.myicomfort.com/LennoxNotificationServer/negotiate';
export const CLOUD_RETRIEVE_URL = 'https://icretrieveapi.myicomfort.com/v1/messages/retrieve';
export const CLOUD_REQUESTDATA_URL = 'https://icrequestdataapi.myicomfort.com/v1/Messages/RequestData';
export const CLOUD_PUBLISH_URL = 'https://icpublishapi.myicomfort.com/v1/messages/publish';
export const CLOUD_LOGOUT_URL = 'https://ic3messaging.myicomfort.com/v1/user/logout';

// User-Agent string matching the mobile app
export const USER_AGENT = 'lx_ic3_mobile_appstore/3.75.218 (iPad; iOS 14.4.1; Scale/2.00)';

// ============================================================================
// Certificate for authentication
// This is the certificate used by the mobile app to authenticate with Lennox
// ============================================================================

export const CERTIFICATE = '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';

// ============================================================================
// Default Configuration
// ============================================================================

export const LENNOX_DEFAULT_CLOUD_APP_ID = 'mapp079372367644467046827001';
export const DEFAULT_POLL_INTERVAL = 10;  // seconds
export const DEFAULT_FAST_POLL_INTERVAL = 1;  // seconds
export const DEFAULT_TIMEOUT = 60000;  // milliseconds
export const TOKEN_REFRESH_BUFFER = 300;  // seconds before expiry to refresh

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

// Map tempOperation to HomeKit CurrentHeatingCoolingState
export const TEMP_OPERATION_TO_HOMEKIT: Record<string, HomekitHeatingCoolingState> = {
  [LENNOX_TEMP_OPERATION_OFF]: HomekitHeatingCoolingState.OFF,
  [LENNOX_TEMP_OPERATION_HEATING]: HomekitHeatingCoolingState.HEAT,
  [LENNOX_TEMP_OPERATION_COOLING]: HomekitHeatingCoolingState.COOL,
};

// ============================================================================
// Fan Mode Constants
// ============================================================================

export const LENNOX_FAN_AUTO = 'auto';
export const LENNOX_FAN_ON = 'on';
export const LENNOX_FAN_CIRCULATE = 'circulate';

// ============================================================================
// Status Constants
// ============================================================================

export const LENNOX_STATUS_GOOD = 'good';
export const LENNOX_STATUS_NOT_AVAILABLE = 'not_available';
export const LENNOX_STATUS_NOT_EXIST = 'not_exist';

export const LENNOX_BAD_STATUS = [
  LENNOX_STATUS_NOT_AVAILABLE,
  LENNOX_STATUS_NOT_EXIST,
];

// ============================================================================
// Error Codes
// ============================================================================

export const EC_AUTHENTICATE = 'AUTHENTICATE_FAILED';
export const EC_LOGIN = 'LOGIN_FAILED';
export const EC_UNAUTHORIZED = 'UNAUTHORIZED';
export const EC_HTTP_ERR = 'HTTP_ERROR';
export const EC_COMMS_ERROR = 'COMMUNICATION_ERROR';
export const EC_CONFIG_TIMEOUT = 'CONFIG_TIMEOUT';
export const EC_BAD_PARAMETERS = 'BAD_PARAMETERS';

// ============================================================================
// Message Types
// ============================================================================

export const MESSAGE_TYPE_PROPERTY_CHANGE = 'PropertyChange';
export const MESSAGE_TYPE_REQUEST_DATA = 'RequestData';
export const MESSAGE_TYPE_SUBSCRIPTION = 'Subscription';
