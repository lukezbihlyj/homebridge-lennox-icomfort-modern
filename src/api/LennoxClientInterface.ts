/**
 * Common interface for Lennox thermostat clients
 * Implemented by both LennoxS30Client and LennoxWifiClient
 */

import { Logger } from './LennoxS30Client';

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

  /** Cooling setpoint in Fahrenheit */
  csp: number;

  /** Current HVAC mode: 'off', 'heat', 'cool', 'heat and cool', 'emergency heat' */
  systemMode: string;

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

  /** Check if zone is active (has data) */
  isActive(): boolean;
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
   */
  initialize(): Promise<void>;

  /**
   * Get all discovered zones
   */
  getZones(): ThermostatZone[];

  /**
   * Register callback for zone updates
   */
  onUpdate(callback: ZoneUpdateCallback): void;

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

