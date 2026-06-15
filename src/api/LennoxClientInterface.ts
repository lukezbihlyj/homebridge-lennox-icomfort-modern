/**
 * Common interface for Lennox thermostat clients
 * Implemented by both LennoxS30Client and LennoxWifiClient
 */

/**
 * Logger interface for compatibility with Homebridge
 */
export interface Logger {
  info(message: string, ...parameters: unknown[]): void;
  warn(message: string, ...parameters: unknown[]): void;
  error(message: string, ...parameters: unknown[]): void;
  debug(message: string, ...parameters: unknown[]): void;
}

/**
 * Represents a thermostat zone that can be controlled
 */
export interface ThermostatZone {
  /** Unique identifier for this zone */
  uniqueId: string;

  /** Zone ID number */
  id: number;

  /** Zone name */
  name: string;

  /** System/Gateway ID this zone belongs to */
  systemId: string;

  /** System/Gateway name */
  systemName: string;

  /** Current temperature in Fahrenheit */
  temperature: number | null;

  /** Current humidity percentage */
  humidity: number | null;

  /** Heating setpoint in Fahrenheit */
  hsp: number;

  /** Heating setpoint in Celsius */
  hspC: number;

  /** Cooling setpoint in Fahrenheit */
  csp: number;

  /** Cooling setpoint in Celsius */
  cspC: number;

  /** Single setpoint in Fahrenheit (for single setpoint mode) */
  sp: number;

  /** Single setpoint in Celsius (for single setpoint mode) */
  spC: number;

  /** Humidity setpoint */
  husp: number;

  /** Dehumidification setpoint */
  desp: number;

  /** Current HVAC mode: 'off', 'heat', 'cool', 'heat and cool', 'emergency heat' */
  systemMode: string;

  /** Current fan mode: 'auto', 'on', 'circulate' */
  fanMode: string;

  /** Current humidity mode: 'off', 'humidify', 'dehumidify' */
  humidityMode: string;

  /** Current operation: 'off', 'heating', 'cooling' */
  tempOperation: string;

  /** Whether zone supports heating */
  heatingOption: boolean;

  /** Whether zone supports cooling */
  coolingOption: boolean;

  /** Whether zone supports emergency heat */
  emergencyHeatingOption: boolean;

  /** Product type/model */
  productType: string;

  /** Firmware version */
  firmwareVersion: string;

  /** Number of zones in the system */
  numberOfZones: number;

  /** Current schedule ID the zone is following */
  scheduleId: number;

  /** Start time of current period */
  startTime: number;

  /** Check if zone is active (has data) */
  isActive(): boolean;

  /** Get manual mode schedule ID for this zone */
  getManualModeScheduleId(): number;

  /** Get override schedule ID for this zone */
  getOverrideScheduleId(): number;

  /** Check if zone is in manual mode */
  isZoneManualMode(): boolean;

  /** Check if zone is in override mode */
  isZoneOverride(): boolean;
}

/**
 * Common configuration for Lennox clients
 */
export interface LennoxClientConfig {
  email: string;
  password: string;
  appId?: string;
  pollInterval?: number;
}

/**
 * Update callback type
 */
export type ZoneUpdateCallback = (zone: ThermostatZone) => void;

/**
 * Common interface for Lennox API clients
 */
export interface LennoxClient {
  /**
   * Connect and authenticate with the Lennox cloud
   */
  serverConnect(): Promise<void>;

  /**
   * Initialize and discover all zones
   * @returns true if all zones were discovered, false if initialization timed out
   */
  initialize(): Promise<boolean>;

  /**
   * Get all discovered zones
   */
  getZones(): ThermostatZone[];

  /**
   * Register callback for zone updates
   */
  onUpdate(callback: ZoneUpdateCallback): void;

  /**
   * Register callback for when a zone becomes active (receives data for the first time)
   * Used to handle late zone discovery after initialization timeout.
   */
  onNewZone(callback: ZoneUpdateCallback): void;

  /**
   * Start the message/polling pump for real-time updates
   */
  startMessagePump(onError?: (error: Error) => void): Promise<void>;

  /**
   * Set the HVAC mode for a zone
   * @param zone The zone to control
   * @param mode The mode: 'off', 'heat', 'cool', 'heat and cool', 'emergency heat'
   */
  setHVACMode(zone: ThermostatZone, mode: string): Promise<void>;

  /**
   * Set the temperature setpoints for a zone
   * @param zone The zone to control
   * @param options Temperature setpoints (hsp for heat, csp for cool)
   */
  setTemperature(zone: ThermostatZone, options: { hsp?: number; csp?: number }): Promise<void>;

  /**
   * Shutdown the client
   */
  shutdown(): Promise<void>;
}

/**
 * Factory function type for creating clients
 */
export type LennoxClientFactory = (config: LennoxClientConfig, log: Logger) => LennoxClient;

