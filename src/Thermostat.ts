import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { LennoxIComfortCloudPlatform } from './platform';
import {
  ThermostatZone,
  LENNOX_HVAC_OFF,
  LENNOX_HVAC_HEAT,
  LENNOX_HVAC_COOL,
  LENNOX_HVAC_HEAT_COOL,
  LENNOX_HVAC_EMERGENCY_HEAT,
  LENNOX_TO_HOMEKIT_MODE,
  HOMEKIT_TO_LENNOX_MODE,
  TEMP_OPERATION_TO_HOMEKIT,
  HomekitHeatingCoolingState,
} from './api';

/**
 * Thermostat accessory for a Lennox zone
 * Works with S30/S40/E30/M30 and Wifi thermostats
 */
export class Thermostat {
  private service: Service;
  private emergencyHeatSwitch: Service | null = null;

  // Reference to zone data
  private zone: ThermostatZone;

  // Debounce: ignore updates for a short time after sending a command
  private lastCommandTime = 0;
  private readonly COMMAND_DEBOUNCE_MS = 5000; // 5 seconds

  constructor(
    private readonly platform: LennoxIComfortCloudPlatform,
    private readonly accessory: PlatformAccessory,
    zone: ThermostatZone,
  ) {
    this.zone = zone;

    // Set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Name, this.displayName)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, zone.uniqueId)
      .setCharacteristic(this.platform.Characteristic.FirmwareRevision, zone.firmwareVersion)
      .setCharacteristic(this.platform.Characteristic.Model, zone.productType)
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Lennox');

    // Get or create thermostat service
    this.service = this.accessory.getService(this.platform.Service.Thermostat)
      || this.accessory.addService(this.platform.Service.Thermostat);

    this.service.setCharacteristic(this.platform.Characteristic.Name, this.displayName);

    // Configure characteristics
    this.setupCharacteristics();

    // Setup emergency heat switch if available
    this.setupEmergencyHeatSwitch();
  }

  /**
   * Get display name for the accessory
   */
  private get displayName(): string {
    let baseName: string;

    if (this.zone.numberOfZones > 1) {
      baseName = `${this.zone.systemName} - ${this.zone.name}`;
    } else {
      baseName = this.zone.systemName;
    }

    // Add "Thermostat" suffix if not already present
    if (baseName.toLowerCase().endsWith('thermostat')) {
      return baseName;
    }
    return `${baseName} Thermostat`;
  }

  /**
   * Log info message
   */
  private logInfo(...args: string[]): void {
    this.platform.log.info(`[${this.zone.uniqueId}] ${this.displayName} ${args.join(' ')}`);
  }

  /**
   * Log debug message
   */
  private logDebug(...args: string[]): void {
    this.platform.log.debug(`[${this.zone.uniqueId}] ${this.displayName} ${args.join(' ')}`);
  }

  /**
   * Setup all thermostat characteristics
   */
  private setupCharacteristics(): void {
    // Current Heating/Cooling State (read-only)
    this.service.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
      .onGet(this.getCurrentHeatingCoolingState.bind(this));

    // Target Heating/Cooling State
    this.service.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .onGet(this.getTargetHeatingCoolingState.bind(this))
      .onSet(this.setTargetHeatingCoolingState.bind(this));

    // Current Temperature
    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    // Target Temperature
    this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this));

    // Temperature Display Units
    this.service.getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
      .onGet(this.getTemperatureDisplayUnits.bind(this));

    // Heating Threshold Temperature (for Auto mode)
    this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .onGet(this.getHeatingThresholdTemperature.bind(this))
      .onSet(this.setHeatingThresholdTemperature.bind(this));

    // Cooling Threshold Temperature (for Auto mode)
    this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .onGet(this.getCoolingThresholdTemperature.bind(this))
      .onSet(this.setCoolingThresholdTemperature.bind(this));

    // Current Relative Humidity
    this.service.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
      .onGet(this.getCurrentRelativeHumidity.bind(this));
  }

  /**
   * Setup emergency heat switch if enabled in config and zone supports it
   */
  private setupEmergencyHeatSwitch(): void {
    const switchName = `${this.displayName} Emergency Heat`;

    // Check if emergency heat is enabled in config AND the zone supports it
    if (this.platform.enableEmergencyHeat && this.zone.emergencyHeatingOption) {
      this.logInfo('Emergency heat option available, creating switch');

      // Get or create the emergency heat switch service
      this.emergencyHeatSwitch = this.accessory.getService(switchName)
        || this.accessory.addService(this.platform.Service.Switch, switchName, 'emergency-heat');

      this.emergencyHeatSwitch.setCharacteristic(this.platform.Characteristic.Name, switchName);

      // Configure the switch
      this.emergencyHeatSwitch.getCharacteristic(this.platform.Characteristic.On)
        .onGet(this.getEmergencyHeatState.bind(this))
        .onSet(this.setEmergencyHeatState.bind(this));
    } else {
      // Remove the switch if it exists but emergency heat is not enabled/available
      const existingSwitch = this.accessory.getService(switchName);
      if (existingSwitch) {
        this.logInfo('Emergency heat switch disabled or not available, removing');
        this.accessory.removeService(existingSwitch);
      }
      this.emergencyHeatSwitch = null;
    }
  }

  /**
   * Get emergency heat switch state
   */
  async getEmergencyHeatState(): Promise<CharacteristicValue> {
    const isEmergencyHeat = this.zone.systemMode === LENNOX_HVAC_EMERGENCY_HEAT;
    this.logDebug(`Emergency heat state: ${isEmergencyHeat}`);
    return isEmergencyHeat;
  }

  /**
   * Set emergency heat switch state
   */
  async setEmergencyHeatState(value: CharacteristicValue): Promise<void> {
    const enable = value as boolean;
    this.logInfo(`Setting emergency heat to ${enable ? 'ON' : 'OFF'}`);

    try {
      // Mark command time for debounce
      this.lastCommandTime = Date.now();

      if (enable) {
        // Turn on emergency heat
        await this.platform.client.setHVACMode(this.zone, LENNOX_HVAC_EMERGENCY_HEAT);
      } else {
        // Turn off emergency heat - switch to regular heat mode
        await this.platform.client.setHVACMode(this.zone, LENNOX_HVAC_HEAT);
      }
    } catch (error) {
      this.platform.log.error(`Failed to set emergency heat: ${error}`);
      throw error;
    }
  }

  /**
   * Update from zone data (called when API receives updates)
   */
  updateFromZone(zone: ThermostatZone): void {
    this.zone = zone;

    // Ignore updates during debounce period after sending a command
    const timeSinceLastCommand = Date.now() - this.lastCommandTime;
    if (timeSinceLastCommand < this.COMMAND_DEBOUNCE_MS) {
      this.logDebug(`Ignoring update during debounce (${timeSinceLastCommand}ms since last command)`);
      return;
    }

    // Update characteristics with new values
    this.service.updateCharacteristic(
      this.platform.Characteristic.CurrentHeatingCoolingState,
      this.mapTempOperationToHomeKit(zone.tempOperation),
    );

    this.service.updateCharacteristic(
      this.platform.Characteristic.TargetHeatingCoolingState,
      this.mapSystemModeToHomeKit(zone.systemMode),
    );

    this.service.updateCharacteristic(
      this.platform.Characteristic.CurrentTemperature,
      this.toCelsius(zone.temperature ?? 70),
    );

    this.service.updateCharacteristic(
      this.platform.Characteristic.CurrentRelativeHumidity,
      zone.humidity ?? 50,
    );

    // Update setpoints based on mode
    if (this.isAutoMode()) {
      this.service.updateCharacteristic(
        this.platform.Characteristic.HeatingThresholdTemperature,
        this.toCelsius(zone.hsp),
      );
      this.service.updateCharacteristic(
        this.platform.Characteristic.CoolingThresholdTemperature,
        this.toCelsius(zone.csp),
      );
    } else {
      this.service.updateCharacteristic(
        this.platform.Characteristic.TargetTemperature,
        this.getActiveTargetTemperatureCelsius(),
      );
    }

    // Update emergency heat switch if present
    if (this.emergencyHeatSwitch) {
      this.emergencyHeatSwitch.updateCharacteristic(
        this.platform.Characteristic.On,
        zone.systemMode === LENNOX_HVAC_EMERGENCY_HEAT,
      );
    }
  }

  /**
   * Check if system is in auto (heat/cool) mode
   */
  private isAutoMode(): boolean {
    return this.zone.systemMode === LENNOX_HVAC_HEAT_COOL;
  }

  /**
   * Map Lennox tempOperation to HomeKit CurrentHeatingCoolingState
   */
  private mapTempOperationToHomeKit(tempOperation: string): number {
    return TEMP_OPERATION_TO_HOMEKIT[tempOperation] ?? HomekitHeatingCoolingState.OFF;
  }

  /**
   * Map Lennox systemMode to HomeKit TargetHeatingCoolingState
   */
  private mapSystemModeToHomeKit(systemMode: string): number {
    return LENNOX_TO_HOMEKIT_MODE[systemMode] ?? HomekitHeatingCoolingState.OFF;
  }

  /**
   * Map HomeKit TargetHeatingCoolingState to Lennox systemMode
   */
  private mapHomeKitToLennoxMode(state: number): string {
    return HOMEKIT_TO_LENNOX_MODE[state as HomekitHeatingCoolingState] ?? LENNOX_HVAC_OFF;
  }

  /**
   * Convert Fahrenheit to Celsius
   */
  private toCelsius(fahrenheit: number): number {
    return Number((((fahrenheit - 32) * 5) / 9).toFixed(1));
  }

  /**
   * Convert Celsius to Fahrenheit
   */
  private toFahrenheit(celsius: number): number {
    return Math.round((celsius * 9) / 5 + 32);
  }

  /**
   * Get active target temperature in Celsius
   */
  private getActiveTargetTemperatureCelsius(): number {
    const mode = this.zone.systemMode;

    if (mode === LENNOX_HVAC_HEAT) {
      return this.toCelsius(this.zone.hsp);
    } else if (mode === LENNOX_HVAC_COOL) {
      return this.toCelsius(this.zone.csp);
    } else if (mode === LENNOX_HVAC_HEAT_COOL) {
      // In auto mode, return the closer setpoint to current temp
      const currentTemp = this.zone.temperature ?? 70;
      if (currentTemp > this.zone.csp) {
        return this.toCelsius(this.zone.csp);
      } else if (currentTemp < this.zone.hsp) {
        return this.toCelsius(this.zone.hsp);
      }
      // If between setpoints, return the average
      return this.toCelsius((this.zone.hsp + this.zone.csp) / 2);
    }

    // Default to current temperature if off
    return this.toCelsius(this.zone.temperature ?? 70);
  }

  // ============================================================================
  // Characteristic Handlers
  // ============================================================================

  /**
   * Get current heating/cooling state (what the system is actively doing)
   */
  async getCurrentHeatingCoolingState(): Promise<CharacteristicValue> {
    const state = this.mapTempOperationToHomeKit(this.zone.tempOperation);
    this.logDebug(`Current heating/cooling state: ${this.zone.tempOperation} -> ${state}`);
    return state;
  }

  /**
   * Get target heating/cooling state (what mode the user has selected)
   */
  async getTargetHeatingCoolingState(): Promise<CharacteristicValue> {
    const state = this.mapSystemModeToHomeKit(this.zone.systemMode);
    this.logDebug(`Target heating/cooling state: ${this.zone.systemMode} -> ${state}`);
    return state;
  }

  /**
   * Set target heating/cooling state
   */
  async setTargetHeatingCoolingState(value: CharacteristicValue): Promise<void> {
    const mode = this.mapHomeKitToLennoxMode(value as number);
    this.logInfo(`Setting target heating/cooling state to ${mode}`);

    try {
      // Mark command time for debounce
      this.lastCommandTime = Date.now();

      await this.platform.client.setHVACMode(this.zone, mode);
    } catch (error) {
      this.platform.log.error(`Failed to set HVAC mode: ${error}`);
      throw error;
    }
  }

  /**
   * Get current temperature in Celsius
   */
  async getCurrentTemperature(): Promise<CharacteristicValue> {
    const tempF = this.zone.temperature ?? 70;
    const tempC = this.toCelsius(tempF);
    this.logDebug(`Current temperature: ${tempF}°F (${tempC}°C)`);
    return tempC;
  }

  /**
   * Get target temperature in Celsius
   */
  async getTargetTemperature(): Promise<CharacteristicValue> {
    const tempC = this.getActiveTargetTemperatureCelsius();
    this.logDebug(`Target temperature: ${tempC}°C`);
    return tempC;
  }

  /**
   * Set target temperature
   */
  async setTargetTemperature(value: CharacteristicValue): Promise<void> {
    const tempC = value as number;
    const tempF = this.toFahrenheit(tempC);
    this.logInfo(`Setting target temperature to ${tempF}°F (${tempC}°C)`);

    try {
      const mode = this.zone.systemMode;

      if (mode === LENNOX_HVAC_OFF) {
        this.logDebug('System is off, not setting temperature');
        return;
      }

      if (mode === LENNOX_HVAC_HEAT_COOL) {
        this.logDebug('System is in auto mode, use threshold temperatures instead');
        return;
      }

      // Mark command time for debounce
      this.lastCommandTime = Date.now();

      if (mode === LENNOX_HVAC_HEAT) {
        // Ensure cooling setpoint stays above heating setpoint
        let csp = this.zone.csp;
        if (csp < tempF + 3) {
          csp = tempF + 3;
        }
        await this.platform.client.setTemperature(this.zone, { hsp: tempF, csp });
      } else if (mode === LENNOX_HVAC_COOL) {
        // Ensure heating setpoint stays below cooling setpoint
        let hsp = this.zone.hsp;
        if (hsp > tempF - 3) {
          hsp = tempF - 3;
        }
        await this.platform.client.setTemperature(this.zone, { hsp, csp: tempF });
      }
    } catch (error) {
      this.platform.log.error(`Failed to set temperature: ${error}`);
      throw error;
    }
  }

  /**
   * Get temperature display units
   */
  async getTemperatureDisplayUnits(): Promise<CharacteristicValue> {
    return this.platform.temperatureUnit;
  }

  /**
   * Get heating threshold temperature (for auto mode)
   */
  async getHeatingThresholdTemperature(): Promise<CharacteristicValue> {
    const tempC = this.toCelsius(this.zone.hsp);
    this.logDebug(`Heating threshold: ${this.zone.hsp}°F (${tempC}°C)`);
    return tempC;
  }

  /**
   * Set heating threshold temperature
   */
  async setHeatingThresholdTemperature(value: CharacteristicValue): Promise<void> {
    const tempC = value as number;
    const tempF = this.toFahrenheit(tempC);
    this.logInfo(`Setting heating threshold to ${tempF}°F (${tempC}°C)`);

    try {
      // Ensure cooling setpoint stays above heating setpoint
      let csp = this.zone.csp;
      if (csp < tempF + 3) {
        csp = tempF + 3;
        this.logInfo(`Adjusting cooling threshold to ${csp}°F to maintain 3° deadband`);

        // Update the cooling threshold characteristic
        this.service.updateCharacteristic(
          this.platform.Characteristic.CoolingThresholdTemperature,
          this.toCelsius(csp),
        );
      }

      // Mark command time for debounce
      this.lastCommandTime = Date.now();

      await this.platform.client.setTemperature(this.zone, { hsp: tempF, csp });
    } catch (error) {
      this.platform.log.error(`Failed to set heating threshold: ${error}`);
      throw error;
    }
  }

  /**
   * Get cooling threshold temperature (for auto mode)
   */
  async getCoolingThresholdTemperature(): Promise<CharacteristicValue> {
    const tempC = this.toCelsius(this.zone.csp);
    this.logDebug(`Cooling threshold: ${this.zone.csp}°F (${tempC}°C)`);
    return tempC;
  }

  /**
   * Set cooling threshold temperature
   */
  async setCoolingThresholdTemperature(value: CharacteristicValue): Promise<void> {
    const tempC = value as number;
    const tempF = this.toFahrenheit(tempC);
    this.logInfo(`Setting cooling threshold to ${tempF}°F (${tempC}°C)`);

    try {
      // Ensure heating setpoint stays below cooling setpoint
      let hsp = this.zone.hsp;
      if (hsp > tempF - 3) {
        hsp = tempF - 3;
        this.logInfo(`Adjusting heating threshold to ${hsp}°F to maintain 3° deadband`);

        // Update the heating threshold characteristic
        this.service.updateCharacteristic(
          this.platform.Characteristic.HeatingThresholdTemperature,
          this.toCelsius(hsp),
        );
      }

      // Mark command time for debounce
      this.lastCommandTime = Date.now();

      await this.platform.client.setTemperature(this.zone, { hsp, csp: tempF });
    } catch (error) {
      this.platform.log.error(`Failed to set cooling threshold: ${error}`);
      throw error;
    }
  }

  /**
   * Get current relative humidity
   */
  async getCurrentRelativeHumidity(): Promise<CharacteristicValue> {
    const humidity = this.zone.humidity ?? 50;
    this.logDebug(`Current humidity: ${humidity}%`);
    return humidity;
  }
}
