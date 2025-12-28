/**
 * Lennox iComfort Wifi Cloud API Client
 * For older iComfort Wifi thermostats that use myicomfort.com
 *
 * Ported from the icomfort npm package
 */

import { LennoxClient, LennoxClientConfig, ThermostatZone, ZoneUpdateCallback } from './LennoxClientInterface';
import { Logger } from './LennoxS30Client';
import {
  LENNOX_HVAC_OFF,
  LENNOX_HVAC_HEAT,
  LENNOX_HVAC_COOL,
  LENNOX_HVAC_HEAT_COOL,
  LENNOX_TEMP_OPERATION_OFF,
  LENNOX_TEMP_OPERATION_HEATING,
  LENNOX_TEMP_OPERATION_COOLING,
} from './constants';

// ============================================================================
// API Constants
// ============================================================================

const ICOMFORT_BASE_URL = 'https://services.myicomfort.com/DBAcessService.svc';
const DEFAULT_POLL_INTERVAL = 30000; // 30 seconds for Wifi (API is slower)

// ============================================================================
// API Types
// ============================================================================

interface SystemInfo {
  Gateway_SN: string;
  System_Name: string;
  Firmware_Ver: string;
}

interface SystemsInfoResponse {
  ReturnStatus: string;
  Systems: SystemInfo[];
}

interface ThermostatInfo {
  Away_Mode: number;
  Central_Zoned_Away: number;
  ConnectionStatus: string;
  Cool_Set_Point: number;
  DateTime_Mark: string;
  Fan_Mode: number;
  GMT_To_Local: number;
  GatewaySN: string;
  Golden_Table_Updated: boolean;
  Heat_Set_Point: number;
  Indoor_Humidity: number;
  Indoor_Temp: number;
  Operation_Mode: number;
  Pref_Temp_Units: string;
  Program_Schedule_Mode: string;
  Program_Schedule_Selection: number;
  System_Status: number;
  Zone_Enabled: number;
  Zone_Name: string;
  Zone_Number: number;
  Zones_Installed: number;
  // Added by us
  System_Name?: string;
  deviceFirmware?: string;
}

interface ThermostatInfoResponse {
  ReturnStatus: string;
  tStatInfo: ThermostatInfo[];
}

// ============================================================================
// Wifi Zone Implementation
// ============================================================================

/**
 * Represents a zone/thermostat from the Wifi API
 */
export class WifiThermostatZone implements ThermostatZone {
  public id: number;
  public name: string;
  public systemId: string;
  public systemName: string;
  public productType: string = 'iComfort Wifi';
  public firmwareVersion: string = '';

  // State
  public temperature: number | null = null;
  public humidity: number | null = null;
  public hsp: number = 68;
  public csp: number = 78;
  public systemMode: string = LENNOX_HVAC_OFF;
  public tempOperation: string = LENNOX_TEMP_OPERATION_OFF;

  // Capabilities
  public heatingOption: boolean = true;
  public coolingOption: boolean = true;
  public emergencyHeatingOption: boolean = false;
  public numberOfZones: number = 1;

  constructor(gatewaySN: string, systemName: string, zoneNumber: number = 0) {
    this.systemId = gatewaySN;
    this.systemName = systemName;
    this.id = zoneNumber;
    this.name = systemName;
  }

  get uniqueId(): string {
    return `${this.systemId}_zone_${this.id}`.replace(/-/g, '');
  }

  isActive(): boolean {
    return this.temperature !== null;
  }

  /**
   * Update zone from thermostat info response
   */
  updateFromThermostatInfo(info: ThermostatInfo): void {
    this.temperature = info.Indoor_Temp;
    this.humidity = info.Indoor_Humidity;
    this.hsp = info.Heat_Set_Point;
    this.csp = info.Cool_Set_Point;
    this.name = info.Zone_Name || this.systemName;

    // Map Operation_Mode to systemMode
    switch (info.Operation_Mode) {
      case 0:
        this.systemMode = LENNOX_HVAC_OFF;
        break;
      case 1:
        this.systemMode = LENNOX_HVAC_HEAT;
        break;
      case 2:
        this.systemMode = LENNOX_HVAC_COOL;
        break;
      case 3:
        this.systemMode = LENNOX_HVAC_HEAT_COOL;
        break;
      default:
        this.systemMode = LENNOX_HVAC_OFF;
    }

    // Map System_Status to tempOperation
    switch (info.System_Status) {
      case 0:
        this.tempOperation = LENNOX_TEMP_OPERATION_OFF;
        break;
      case 1:
        this.tempOperation = LENNOX_TEMP_OPERATION_HEATING;
        break;
      case 2:
        this.tempOperation = LENNOX_TEMP_OPERATION_COOLING;
        break;
      default:
        this.tempOperation = LENNOX_TEMP_OPERATION_OFF;
    }
  }
}

// ============================================================================
// Wifi Client Implementation
// ============================================================================

/**
 * Lennox iComfort Wifi API Client
 */
export class LennoxWifiClient implements LennoxClient {
  private email: string;
  private password: string;
  private pollInterval: number;
  private log: Logger;

  // Discovered zones
  private zones: Map<string, WifiThermostatZone> = new Map();

  // Callbacks for updates
  private updateCallbacks: ZoneUpdateCallback[] = [];

  // Polling state
  private isPolling: boolean = false;

  constructor(config: LennoxClientConfig, log: Logger) {
    this.email = config.email;
    this.password = config.password;
    this.pollInterval = (config.pollInterval || 30) * 1000; // Default 30s for Wifi
    this.log = log;
  }

  // ============================================================================
  // HTTP Request Helpers
  // ============================================================================

  /**
   * Make an authenticated request to the iComfort API
   */
  private async request<T>(
    method: 'GET' | 'PUT',
    endpoint: string,
    queryParams?: Record<string, string | number>,
    body?: unknown,
  ): Promise<T> {
    let url = `${ICOMFORT_BASE_URL}${endpoint}`;

    // Add query parameters
    if (queryParams && Object.keys(queryParams).length > 0) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(queryParams)) {
        params.append(key, String(value));
      }
      url += `?${params.toString()}`;
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Authorization': 'Basic ' + Buffer.from(`${this.email}:${this.password}`).toString('base64'),
    };

    if (method !== 'GET' && body) {
      headers['Content-Type'] = 'application/json';
    }

    const options: RequestInit = {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    };

    this.log.debug(`[Wifi API] ${method} ${endpoint}`);

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as T;
    return data;
  }

  /**
   * Get list of systems for the user
   */
  private async getSystemsInfo(): Promise<SystemsInfoResponse> {
    return this.request<SystemsInfoResponse>('GET', '/GetSystemsInfo', {
      UserId: this.email,
    });
  }

  /**
   * Get thermostat info for a gateway
   */
  private async getThermostatInfoList(gatewaySN: string): Promise<ThermostatInfoResponse> {
    return this.request<ThermostatInfoResponse>('GET', '/GetTStatInfoList', {
      GatewaySN: gatewaySN,
      TempUnit: 0, // Fahrenheit
    });
  }

  /**
   * Set thermostat settings
   */
  private async setThermostatInfo(settings: ThermostatInfo): Promise<void> {
    await this.request<number>('PUT', '/SetTStatInfo', {}, settings);
  }

  // ============================================================================
  // LennoxClient Interface Implementation
  // ============================================================================

  async serverConnect(): Promise<void> {
    // Validate credentials by fetching systems
    try {
      const systems = await this.getSystemsInfo();
      if (systems.ReturnStatus !== 'SUCCESS') {
        throw new Error(`API returned status: ${systems.ReturnStatus}`);
      }
      this.log.info(`Successfully authenticated. Found ${systems.Systems.length} system(s).`);
    } catch (error) {
      this.log.error('Failed to connect to iComfort Wifi API:', error);
      throw error;
    }
  }

  async initialize(): Promise<void> {
    this.log.info('Discovering iComfort Wifi thermostats...');

    const systemsResponse = await this.getSystemsInfo();

    for (const system of systemsResponse.Systems) {
      this.log.info(`Found system: ${system.System_Name} (${system.Gateway_SN})`);

      try {
        const thermostatResponse = await this.getThermostatInfoList(system.Gateway_SN);

        if (thermostatResponse.tStatInfo && thermostatResponse.tStatInfo.length > 0) {
          // Filter to only enabled zones
          const enabledZones = thermostatResponse.tStatInfo.filter(t => t.Zone_Enabled === 1);
          const totalZones = thermostatResponse.tStatInfo.length;

          this.log.info(`  Found ${enabledZones.length} enabled zone(s) of ${totalZones} total`);

          for (const tstat of enabledZones) {
            const zone = new WifiThermostatZone(
              system.Gateway_SN,
              system.System_Name,
              tstat.Zone_Number,
            );
            zone.firmwareVersion = system.Firmware_Ver;
            zone.numberOfZones = enabledZones.length;
            zone.updateFromThermostatInfo(tstat);

            const zoneKey = zone.uniqueId;
            this.zones.set(zoneKey, zone);

            this.log.info(`  Zone ${zone.id}: ${zone.name} - ${zone.temperature}°F`);
          }
        }
      } catch (error) {
        this.log.error(`Failed to get thermostat info for ${system.System_Name}:`, error);
      }
    }

    this.log.info(`Initialized ${this.zones.size} thermostat(s)`);
  }

  getZones(): ThermostatZone[] {
    return Array.from(this.zones.values());
  }

  onUpdate(callback: ZoneUpdateCallback): void {
    this.updateCallbacks.push(callback);
  }

  async startMessagePump(onError?: (error: Error) => void): Promise<void> {
    if (this.isPolling) {
      return;
    }

    this.log.info('Starting polling loop...');
    this.isPolling = true;

    const poll = async () => {
      while (this.isPolling) {
        try {
          await this.pollAllZones();
        } catch (error) {
          this.log.debug(`Poll error: ${error}`);
          if (onError && error instanceof Error) {
            onError(error);
          }
        }
        await this.sleep(this.pollInterval);
      }
    };

    // Run in background
    poll().catch(error => {
      this.log.error('Fatal polling error:', error);
    });
  }

  /**
   * Poll all zones for updates
   */
  private async pollAllZones(): Promise<void> {
    const systemIds = new Set<string>();
    for (const zone of this.zones.values()) {
      systemIds.add(zone.systemId);
    }

    for (const systemId of systemIds) {
      try {
        const response = await this.getThermostatInfoList(systemId);

        for (const tstat of response.tStatInfo) {
          const zoneKey = `${systemId}_zone_${tstat.Zone_Number}`.replace(/-/g, '');
          const zone = this.zones.get(zoneKey);

          if (zone) {
            zone.updateFromThermostatInfo(tstat);

            // Notify callbacks
            for (const callback of this.updateCallbacks) {
              try {
                callback(zone);
              } catch {
                // Ignore callback errors
              }
            }
          }
        }
      } catch (error) {
        this.log.debug(`Failed to poll system ${systemId}: ${error}`);
      }
    }
  }

  async setHVACMode(zone: ThermostatZone, mode: string): Promise<void> {
    this.log.info(`Setting HVAC mode for ${zone.name} to ${mode}`);

    const wifiZone = this.zones.get(zone.uniqueId);
    if (!wifiZone) {
      throw new Error(`Zone not found: ${zone.uniqueId}`);
    }

    // Fetch current thermostat state
    const response = await this.getThermostatInfoList(zone.systemId);
    const tstat = response.tStatInfo.find(t => t.Zone_Number === zone.id);

    if (!tstat) {
      throw new Error(`Thermostat not found for zone ${zone.id}`);
    }

    // Map mode string to Operation_Mode number
    let operationMode: number;
    switch (mode) {
      case LENNOX_HVAC_OFF:
        operationMode = 0;
        break;
      case LENNOX_HVAC_HEAT:
        operationMode = 1;
        break;
      case LENNOX_HVAC_COOL:
        operationMode = 2;
        break;
      case LENNOX_HVAC_HEAT_COOL:
        operationMode = 3;
        break;
      default:
        operationMode = 0;
    }

    const newSettings: ThermostatInfo = {
      ...tstat,
      Operation_Mode: operationMode,
    };

    await this.setThermostatInfo(newSettings);
  }

  async setTemperature(zone: ThermostatZone, options: { hsp?: number; csp?: number }): Promise<void> {
    this.log.info(`Setting temperature for ${zone.name}:`, options);

    const wifiZone = this.zones.get(zone.uniqueId);
    if (!wifiZone) {
      throw new Error(`Zone not found: ${zone.uniqueId}`);
    }

    // Fetch current thermostat state
    const response = await this.getThermostatInfoList(zone.systemId);
    const tstat = response.tStatInfo.find(t => t.Zone_Number === zone.id);

    if (!tstat) {
      throw new Error(`Thermostat not found for zone ${zone.id}`);
    }

    const newSettings: ThermostatInfo = { ...tstat };

    if (options.hsp !== undefined) {
      newSettings.Heat_Set_Point = options.hsp;
    }
    if (options.csp !== undefined) {
      newSettings.Cool_Set_Point = options.csp;
    }

    await this.setThermostatInfo(newSettings);
  }

  async shutdown(): Promise<void> {
    this.log.info('Shutting down Lennox Wifi client');
    this.isPolling = false;
    this.zones.clear();
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

