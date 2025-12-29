/**
 * TypeScript interfaces for Lennox iComfort Wifi API
 * Based on the icomfort-js package data structures
 */

import { ThermostatZone } from '../LennoxClientInterface';
import {
  LENNOX_HVAC_OFF,
  LENNOX_HVAC_HEAT,
  LENNOX_HVAC_COOL,
  LENNOX_HVAC_HEAT_COOL,
  LENNOX_TEMP_OPERATION_OFF,
  LENNOX_TEMP_OPERATION_HEATING,
  LENNOX_TEMP_OPERATION_COOLING,
  LENNOX_TEMP_OPERATION_WAITING,
} from '../constants';

// ============================================================================
// API Response Types
// ============================================================================

export interface SystemInfo {
  Gateway_SN: string;
  System_Name: string;
  Firmware_Ver: string;
}

export interface SystemsInfoResponse {
  ReturnStatus: string;
  Systems: SystemInfo[];
}

export interface ThermostatInfo {
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

export interface ThermostatInfoResponse {
  ReturnStatus: string;
  tStatInfo: ThermostatInfo[];
}

// ============================================================================
// Runtime Model Class
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
    // Values: 0=idle, 1=heating, 2=cooling, 3=waiting, 4=emergency heat
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
      case 3:
        this.tempOperation = LENNOX_TEMP_OPERATION_WAITING;
        break;
      case 4:
        // Emergency heat = auxiliary heat is running, show as heating
        this.tempOperation = LENNOX_TEMP_OPERATION_HEATING;
        break;
      default:
        this.tempOperation = LENNOX_TEMP_OPERATION_OFF;
    }
  }
}

