/**
 * TypeScript interfaces for Lennox S30/S40/E30/M30 Cloud API
 * Based on the lennoxs30api Python library data structures
 */

// ============================================================================
// Authentication Types
// ============================================================================

export interface UserToken {
  type: string;
  issueTime: number;
  expiryTime: number;
  encoded: string;
  refreshToken: string;
}

export interface Security {
  certificateToken: string | null;
  lccToken: string | null;
  userToken: UserToken;
  doNotPersist: boolean;
}

export interface ServerAssigned {
  identities: unknown | null;
  urls: unknown | null;
  security: Security;
}

export interface Address {
  streetAddress1: string;
  streetAddress2: string;
  city: string;
  state: string;
  country: string;
  zip: string;
  latitude: string;
  longitude: string;
}

export interface HomeSystem {
  id: number;
  sysId: string;
  controlModelNumber: string | null;
}

export interface Home {
  id: number;
  homeId: string;
  writeAccess: boolean | null;
  type: string | null;
  name: string;
  notifyAlertsToDealer: boolean;
  notifyRemindersToDealer: boolean;
  dealerPermissionToUpdate: string;
  dealerPermissionExpiresAt: string;
  dealerPermissionToView: boolean;
  address: Address;
  systems: HomeSystem[];
}

export interface ReadyHomes {
  homes: Home[];
}

export interface LoginResponse {
  readyHomes: ReadyHomes;
  ServerAssignedRoot: {
    serverAssigned: ServerAssigned;
  };
  myPresence: Record<string, string>;
}

// ============================================================================
// System Configuration Types
// ============================================================================

export interface SystemConfigOptions {
  indoorUnitType: string;
  indoorUnitStaging: number;
  outdoorUnitType: string;
  outdoorUnitStaging: number;
  outdoorUnitCommunicating: boolean;
  humidifierType: string;
  dehumidifierType: string;
  enhancedDehumidificationPidat: boolean;
  productType: string;
  pureAir: {
    unitType: string;
  };
  ventilation: {
    unitType: string;
    controlMode: string;
  };
}

export interface SystemConfig {
  name: string;
  centralMode: boolean;
  temperatureUnit: 'F' | 'C';
  language: string;
  dehumidificationMode: string;
  humidificationMode: string;
  circulateTime: number;
  lccGroupId: number;
  options: SystemConfigOptions;
  enhancedDehumidificationOvercoolingC: number;
  enhancedDehumidificationOvercoolingF: number;
  allergenDefender: boolean;
  ventilationMode: string;
}

export interface SystemStatus {
  diagLevel: number;
  outdoorTemperature: number;
  outdoorTemperatureC: number;
  outdoorTemperatureStatus: string;
  diagRuntime: number;
  diagPoweredHours: number;
  diagVentilationRuntime: number;
  configured: boolean;
  unknownDeviceFound: boolean;
  ventilationRemainingTime: number;
  wideSetpointRange: boolean;
  ventilatingUntilTime: string;
  reminder: boolean;
  configProblem: boolean;
  zoningMode: string;
  replacementPart: boolean;
  alert: string;
  feelsLikeMode: boolean;
  numberOfZones: number;
  singleSetpointMode: boolean;
  missingDeviceFound: boolean;
  rsbusMode: string;
  replaced: boolean;
  incompleteSystem: boolean;
}

export interface SystemTime {
  currentTime: string;
  sysUpTime: number;
}

// ============================================================================
// Zone Types
// ============================================================================

export interface ScheduleHold {
  enabled: boolean;
  exceptionType: string;
  scheduleId: number;
  expirationMode: string;
  expiresOn?: string;
}

export interface ZoneConfig {
  name: string;
  scheduleId: number;
  scheduleHold: ScheduleHold;
  temperatureDeadband: number;
  temperatureDeadbandC: number;
  minCsp: number;
  minCspC: number;
  maxCsp: number;
  maxCspC: number;
  minHsp: number;
  minHspC: number;
  maxHsp: number;
  maxHspC: number;
  minHumSp: number;
  maxHumSp: number;
  minDehumSp: number;
  maxDehumSp: number;
  humidityDeadband: number;
  heatingOption: boolean;
  coolingOption: boolean;
  humidificationOption: boolean;
  dehumidificationOption: boolean;
  emergencyHeatingOption: boolean;
  singleSetpointAvailable: boolean;
  humidificationNotAdjustable: boolean;
  dehumidificationNotAdjustable: boolean;
  zoneEnabled?: number; // 0 = disabled, 1 = enabled
}

export interface ZonePeriod {
  startTime: number;
  systemMode: string;
  fanMode: string;
  husp: number;
  away: boolean;
  sp: number;
  spC: number;
  desp: number;
  csp: number;
  cspC: number;
  hsp: number;
  hspC: number;
  humidityMode: string;
  isCspChanged?: boolean;
  isHspChanged?: boolean;
}

export interface ZoneStatus {
  temperatureStatus: string;
  humidityStatus: string;
  fan: boolean;
  allergenDefender: boolean;
  humidity: number;
  temperature: number;
  temperatureC: number;
  damper: number;
  heatCoast: boolean;
  defrost: boolean;
  coolCoast: boolean;
  aux: boolean;
  ssr: boolean;
  balancePoint: string;
  ventilation: boolean;
  demand: number;
  humOperation: string;
  tempOperation: string;
  scheduleExceptionIds: number[];
  period: ZonePeriod;
}

export interface ZoneSchedulePeriod {
  id: number;
  enabled: boolean;
  period: ZonePeriod;
}

export interface ZoneSchedule {
  periodCount: number;
  name: string;
  periods: ZoneSchedulePeriod[];
}

export interface ZoneData {
  id: number;
  maxItems?: number;
  config?: Partial<ZoneConfig>;
  status?: Partial<ZoneStatus>;
  schedule?: ZoneSchedule;
}

// ============================================================================
// Message Types
// ============================================================================

export interface SystemData {
  config?: SystemConfig;
  status?: SystemStatus;
  time?: SystemTime;
}

export interface MessageData {
  system?: SystemData;
  zones?: ZoneData[];
}

export interface PropertyChangeMessage {
  MessageId?: string;
  MessageID?: string;
  SenderId?: string;
  SenderID?: string;
  TargetID?: string;
  TargetId?: string;
  MessageType: string;
  Data?: MessageData;
}

// ============================================================================
// Runtime Model Classes
// ============================================================================

/**
 * Represents a Lennox Zone with runtime state
 */
export class LennoxZone {
  public id: number;
  public name: string;
  public systemId: string;

  // System info (populated by client)
  public systemName: string = '';
  public productType: string = 'S30';
  public firmwareVersion: string = '1.0';
  public numberOfZones: number = 1;

  // Configuration
  public heatingOption: boolean = false;
  public coolingOption: boolean = false;
  public emergencyHeatingOption: boolean = false;
  public humidificationOption: boolean = false;
  public dehumidificationOption: boolean = false;

  // Temperature limits
  public minCsp: number = 60;
  public maxCsp: number = 99;
  public minCspC: number = 15.5;
  public maxCspC: number = 37;
  public minHsp: number = 40;
  public maxHsp: number = 90;
  public minHspC: number = 4.5;
  public maxHspC: number = 32;

  // Current status - null means not yet received
  public temperature: number | null = null;
  public temperatureC: number | null = null;
  public temperatureStatus: string = 'good';
  public humidity: number | null = null;
  public humidityStatus: string = 'good';

  // Setpoints
  public csp: number = 78;  // Cooling setpoint (F)
  public cspC: number = 25.5;  // Cooling setpoint (C)
  public hsp: number = 68;  // Heating setpoint (F)
  public hspC: number = 20;  // Heating setpoint (C)
  public sp: number = 73;   // Single setpoint (F)
  public spC: number = 22.5;  // Single setpoint (C)
  public husp: number = 40;  // Humidity setpoint
  public desp: number = 50;  // Dehumidification setpoint

  // Operating state
  public systemMode: string = 'off';
  public fanMode: string = 'auto';
  public humidityMode: string = 'off';
  public tempOperation: string = 'off';
  public humOperation: string = 'off';
  public fan: boolean = false;
  public damper: number = 0;
  public demand: number = 0;
  public ventilation: boolean = false;

  // Flags
  public allergenDefender: boolean = false;
  public heatCoast: boolean = false;
  public coolCoast: boolean = false;
  public defrost: boolean = false;
  public aux: boolean = false;
  public zoneEnabled: boolean = false;

  // Callbacks for updates
  private updateCallbacks: Array<() => void> = [];

  constructor(id: number, name: string, systemId: string) {
    this.id = id;
    this.name = name;
    this.systemId = systemId;
  }

  /**
   * Register a callback for zone updates
   */
  onUpdate(callback: () => void): void {
    this.updateCallbacks.push(callback);
  }

  /**
   * Notify all registered callbacks
   */
  private notifyUpdate(): void {
    for (const callback of this.updateCallbacks) {
      try {
        callback();
      } catch {
        // Ignore callback errors
      }
    }
  }

  /**
   * Get unique identifier for this zone
   */
  get uniqueId(): string {
    return `${this.systemId}_zone_${this.id}`.replace(/-/g, '');
  }

  /**
   * Check if zone is active (has received temperature data)
   * Matches Python: return self.temperature is not None
   */
  isActive(): boolean {
    return this.temperature !== null;
  }

  /**
   * Update zone from API data
   */
  updateFromData(data: ZoneData): void {
    if (data.config) {
      if (data.config.name !== undefined) {
        this.name = data.config.name;
      }
      if (data.config.heatingOption !== undefined) {
        this.heatingOption = data.config.heatingOption;
      }
      if (data.config.coolingOption !== undefined) {
        this.coolingOption = data.config.coolingOption;
      }
      if (data.config.emergencyHeatingOption !== undefined) {
        this.emergencyHeatingOption = data.config.emergencyHeatingOption;
      }
      if (data.config.humidificationOption !== undefined) {
        this.humidificationOption = data.config.humidificationOption;
      }
      if (data.config.dehumidificationOption !== undefined) {
        this.dehumidificationOption = data.config.dehumidificationOption;
      }
      if (data.config.minCsp !== undefined) {
        this.minCsp = data.config.minCsp;
      }
      if (data.config.maxCsp !== undefined) {
        this.maxCsp = data.config.maxCsp;
      }
      if (data.config.minCspC !== undefined) {
        this.minCspC = data.config.minCspC;
      }
      if (data.config.maxCspC !== undefined) {
        this.maxCspC = data.config.maxCspC;
      }
      if (data.config.minHsp !== undefined) {
        this.minHsp = data.config.minHsp;
      }
      if (data.config.maxHsp !== undefined) {
        this.maxHsp = data.config.maxHsp;
      }
      if (data.config.minHspC !== undefined) {
        this.minHspC = data.config.minHspC;
      }
      if (data.config.maxHspC !== undefined) {
        this.maxHspC = data.config.maxHspC;
      }
      // Zone is enabled if zoneEnabled is 1 (or missing, keep current value)
      if (data.config.zoneEnabled !== undefined) {
        this.zoneEnabled = data.config.zoneEnabled === 1;
      }
    }

    if (data.status) {
      if (data.status.temperature !== undefined) {
        this.temperature = data.status.temperature;
      }
      if (data.status.temperatureC !== undefined) {
        this.temperatureC = data.status.temperatureC;
      }
      if (data.status.temperatureStatus !== undefined) {
        this.temperatureStatus = data.status.temperatureStatus;
      }
      if (data.status.humidity !== undefined) {
        this.humidity = data.status.humidity;
      }
      if (data.status.humidityStatus !== undefined) {
        this.humidityStatus = data.status.humidityStatus;
      }
      if (data.status.fan !== undefined) {
        this.fan = data.status.fan;
      }
      if (data.status.damper !== undefined) {
        this.damper = data.status.damper;
      }
      if (data.status.demand !== undefined) {
        this.demand = data.status.demand;
      }
      if (data.status.ventilation !== undefined) {
        this.ventilation = data.status.ventilation;
      }
      if (data.status.allergenDefender !== undefined) {
        this.allergenDefender = data.status.allergenDefender;
      }
      if (data.status.heatCoast !== undefined) {
        this.heatCoast = data.status.heatCoast;
      }
      if (data.status.coolCoast !== undefined) {
        this.coolCoast = data.status.coolCoast;
      }
      if (data.status.defrost !== undefined) {
        this.defrost = data.status.defrost;
      }
      if (data.status.aux !== undefined) {
        this.aux = data.status.aux;
      }
      if (data.status.tempOperation !== undefined) {
        this.tempOperation = data.status.tempOperation;
      }
      if (data.status.humOperation !== undefined) {
        this.humOperation = data.status.humOperation;
      }

      // Update from period (current active settings)
      if (data.status.period) {
        if (data.status.period.systemMode !== undefined) {
          this.systemMode = data.status.period.systemMode;
        }
        if (data.status.period.fanMode !== undefined) {
          this.fanMode = data.status.period.fanMode;
        }
        if (data.status.period.humidityMode !== undefined) {
          this.humidityMode = data.status.period.humidityMode;
        }
        if (data.status.period.csp !== undefined) {
          this.csp = data.status.period.csp;
        }
        if (data.status.period.cspC !== undefined) {
          this.cspC = data.status.period.cspC;
        }
        if (data.status.period.hsp !== undefined) {
          this.hsp = data.status.period.hsp;
        }
        if (data.status.period.hspC !== undefined) {
          this.hspC = data.status.period.hspC;
        }
        if (data.status.period.sp !== undefined) {
          this.sp = data.status.period.sp;
        }
        if (data.status.period.spC !== undefined) {
          this.spC = data.status.period.spC;
        }
        if (data.status.period.husp !== undefined) {
          this.husp = data.status.period.husp;
        }
        if (data.status.period.desp !== undefined) {
          this.desp = data.status.period.desp;
        }
      }
    }

    // Notify listeners of update
    this.notifyUpdate();
  }
}

/**
 * Represents a Lennox System with runtime state
 */
export class LennoxSystem {
  public sysId: string;
  public name: string;
  public productType: string = 'S30';
  public temperatureUnit: 'F' | 'C' = 'F';

  // Status
  public outdoorTemperature: number = 0;
  public outdoorTemperatureC: number = 0;
  public outdoorTemperatureStatus: string = 'good';
  public zoningMode: string = 'central';
  public singleSetpointMode: boolean = false;
  public numberOfZones: number = 1;
  public sysUpTime: number = 0;
  public cloudStatus: string = 'online';

  // Zones
  public zones: Map<number, LennoxZone> = new Map();

  constructor(sysId: string, name: string = 'Lennox System') {
    this.sysId = sysId;
    this.name = name;
  }

  /**
   * Get unique identifier for this system
   */
  get uniqueId(): string {
    return this.sysId.replace(/-/g, '');
  }

  /**
   * Get all active zones
   */
  getActiveZones(): LennoxZone[] {
    return Array.from(this.zones.values()).filter(zone => zone.isActive());
  }

  /**
   * Get or create a zone
   */
  getOrCreateZone(id: number): LennoxZone {
    let zone = this.zones.get(id);
    if (!zone) {
      zone = new LennoxZone(id, `Zone ${id + 1}`, this.sysId);
      this.zones.set(id, zone);
    }
    return zone;
  }

  /**
   * Update system from config data
   */
  updateFromConfig(config: SystemConfig): void {
    this.name = config.name;
    this.temperatureUnit = config.temperatureUnit;
    if (config.options) {
      this.productType = config.options.productType || 'S30';
    }
  }

  /**
   * Update system from status data
   */
  updateFromStatus(status: SystemStatus): void {
    this.outdoorTemperature = status.outdoorTemperature;
    this.outdoorTemperatureC = status.outdoorTemperatureC;
    this.outdoorTemperatureStatus = status.outdoorTemperatureStatus;
    this.zoningMode = status.zoningMode;
    this.singleSetpointMode = status.singleSetpointMode;
    this.numberOfZones = status.numberOfZones;
  }

  /**
   * Update system from time data
   */
  updateFromTime(time: SystemTime): void {
    this.sysUpTime = time.sysUpTime;
  }

  /**
   * Process zones data from message
   */
  processZonesData(zones: ZoneData[]): void {
    for (const zoneData of zones) {
      const zone = this.getOrCreateZone(zoneData.id);
      zone.updateFromData(zoneData);
    }
  }
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface SubscribeRequest {
  MessageType: string;
  SenderID: string;
  TargetID: string;
  AdditionalParameters?: {
    publisherpresence?: boolean;
  };
}

export interface PublishRequest {
  MessageType: string;
  SenderID: string;
  TargetID: string;
  Data: Record<string, unknown>;
}

export interface RequestDataParams {
  topics?: string[];
}

export interface LennoxS30Config {
  email: string;
  password: string;
  appId?: string;
  pollInterval?: number;
}

