import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
  UnknownContext,
} from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { Thermostat } from './Thermostat';
import {
  LennoxS30Client,
  LennoxWifiClient,
  LennoxS30Error,
  ThermostatZone,
  LennoxClient,
} from './api';

/**
 * Accessory context for storing zone information
 */
export interface ZoneAccessoryContext {
  systemId: string;
  zoneId: number;
  systemName: string;
  zoneName: string;
  productType: string;
}

/**
 * Device type configuration
 */
export type DeviceType = 's30' | 'wifi';

/**
 * LennoxIComfortCloudPlatform
 * Main platform plugin for Lennox iComfort thermostats
 * Supports both Wifi (older) and S30/S40/E30/M30 (newer) models
 */
export class LennoxIComfortCloudPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // Track restored cached accessories
  public readonly accessories: PlatformAccessory<UnknownContext>[] = [];

  // Platform configuration
  name: string | undefined;
  username: string;
  password: string;
  pollInterval: number;
  debug: boolean;
  enableEmergencyHeat: boolean;
  deviceType: DeviceType;

  // Lennox API client (either S30 or Wifi)
  public client: LennoxClient;

  // S30-specific client reference (for S30-specific features)
  private s30Client?: LennoxS30Client;

  // Temperature display unit preference
  temperatureUnit: number;
  temperatureUnitConfig: string;

  // Map of zone unique IDs to Thermostat handlers
  private thermostatHandlers: Map<string, Thermostat> = new Map();

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    // Validate required configuration
    if (!config.username || !config.password) {
      this.log.warn('Missing required configuration: username and password are required');
      this.log.warn('Please configure the plugin in the Homebridge UI');

      // Set defaults to prevent crashes, but don't start
      this.name = config.name;
      this.username = '';
      this.password = '';
      this.pollInterval = 10;
      this.debug = false;
      this.enableEmergencyHeat = false;
      this.deviceType = 's30';
      this.temperatureUnit = this.Characteristic.TemperatureDisplayUnits.FAHRENHEIT;
      this.temperatureUnitConfig = 'auto';

      // Create a dummy client that won't connect
      this.client = new LennoxS30Client({ email: '', password: '' }, this.log);
      return;
    }

    // Determine device type
    this.deviceType = (config.deviceType as DeviceType) || 's30';
    this.log.info(`Initializing Lennox iComfort platform (${this.deviceType}):`, this.config.name);

    this.name = config.name;
    this.username = config.username;
    this.password = config.password;
    this.pollInterval = config.pollInterval || (this.deviceType === 'wifi' ? 30 : 10);
    this.debug = config.debugmode || false;
    this.enableEmergencyHeat = config.enableEmergencyHeat || false;

    // Temperature unit: will be set from config or auto-detected from thermostat
    this.temperatureUnit = this.Characteristic.TemperatureDisplayUnits.FAHRENHEIT;
    this.temperatureUnitConfig = config.temperatureUnit || 'auto';

    // Initialize the appropriate Lennox API client based on device type
    if (this.deviceType === 'wifi') {
      this.log.info('Using Lennox iComfort Wifi client (myicomfort.com)');
      this.client = new LennoxWifiClient(
        {
          email: this.username,
          password: this.password,
          pollInterval: this.pollInterval,
        },
        this.log,
      );
    } else {
      this.log.info('Using Lennox S30/S40/E30/M30 client (lennoxicomfort.com)');
      this.s30Client = new LennoxS30Client(
        {
          email: this.username,
          password: this.password,
          pollInterval: this.pollInterval,
        },
        this.log,
      );
      this.client = this.s30Client;
    }

    // Register for zone updates
    this.client.onUpdate(this.handleZoneUpdate.bind(this));

    // When Homebridge has finished launching
    this.api.on('didFinishLaunching', async () => {
      this.log.debug('Executed didFinishLaunching callback');
      await this.discoverDevices();
    });
  }

  /**
   * Handle zone updates from the API client
   */
  private handleZoneUpdate(zone: ThermostatZone): void {
    const handler = this.thermostatHandlers.get(zone.uniqueId);
    if (handler) {
      handler.updateFromZone(zone);
    }
  }

  /**
   * Restore cached accessories from disk at startup
   */
  configureAccessory(accessory: PlatformAccessory<UnknownContext>): void {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  /**
   * Discover and register devices from Lennox cloud
   */
  async discoverDevices(): Promise<void> {
    try {
      // Connect to Lennox cloud API
      this.log.info(`Connecting to Lennox ${this.deviceType === 'wifi' ? 'iComfort Wifi' : 'S30'} cloud...`);
      await this.client.serverConnect();

      // Initialize and wait for zone data
      this.log.info('Initializing systems and zones...');
      await this.client.initialize();

      // Start the message pump for ongoing updates
      this.client.startMessagePump((error) => {
        this.log.error('Message pump error:', error.message);
      });

      // Get all discovered zones
      const zones = this.client.getZones();
      this.log.info(`Found ${zones.length} zone(s)`);

      // Set temperature unit from first zone or config
      if (zones.length > 0) {
        this.setTemperatureUnit();
      }

      // Register each zone as a thermostat accessory
      for (const zone of zones) {
        this.registerZoneAccessory(zone);
      }

      // Remove any cached accessories that are no longer present
      this.cleanupStaleAccessories();

    } catch (error) {
      if (error instanceof LennoxS30Error) {
        this.log.error(`Failed to connect to Lennox cloud: ${error.message} (${error.errorCode})`);
      } else {
        this.log.error('Failed to discover devices:', error);
      }
    }
  }

  /**
   * Set temperature unit based on config
   */
  private setTemperatureUnit(): void {
    if (this.temperatureUnitConfig === 'C') {
      this.temperatureUnit = this.Characteristic.TemperatureDisplayUnits.CELSIUS;
      this.log.info('Temperature unit set to Celsius (from config)');
    } else if (this.temperatureUnitConfig === 'F') {
      this.temperatureUnit = this.Characteristic.TemperatureDisplayUnits.FAHRENHEIT;
      this.log.info('Temperature unit set to Fahrenheit (from config)');
    } else {
      // Auto: default to Fahrenheit
      this.temperatureUnit = this.Characteristic.TemperatureDisplayUnits.FAHRENHEIT;
      this.log.info('Temperature unit set to Fahrenheit (default)');
    }
  }

  /**
   * Register a zone as a thermostat accessory
   */
  private registerZoneAccessory(zone: ThermostatZone): void {
    // Generate unique ID for this zone
    const uniqueId = this.debug ? `dev_${zone.uniqueId}` : zone.uniqueId;
    const uuid = this.api.hap.uuid.generate(uniqueId);

    // Build display name: "System Name - Zone Name" or just system name if only one zone
    const displayName = zone.numberOfZones > 1
      ? `${zone.systemName} - ${zone.name}`
      : zone.systemName;

    // Check if accessory already exists
    const existingAccessory = this.accessories.find(acc => acc.UUID === uuid);

    if (existingAccessory) {
      this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

      // Update context with latest info
      existingAccessory.context = {
        systemId: zone.systemId,
        zoneId: zone.id,
        systemName: zone.systemName,
        zoneName: zone.name,
        productType: zone.productType,
      } as ZoneAccessoryContext;

      this.api.updatePlatformAccessories([existingAccessory]);

      // Create thermostat handler
      const handler = new Thermostat(this, existingAccessory, zone);
      this.thermostatHandlers.set(zone.uniqueId, handler);

    } else {
      this.log.info('Adding new accessory:', displayName);

      // Create new accessory
      const accessory = new this.api.platformAccessory(displayName, uuid);

      // Store context
      accessory.context = {
        systemId: zone.systemId,
        zoneId: zone.id,
        systemName: zone.systemName,
        zoneName: zone.name,
        productType: zone.productType,
      } as ZoneAccessoryContext;

      // Create thermostat handler
      const handler = new Thermostat(this, accessory, zone);
      this.thermostatHandlers.set(zone.uniqueId, handler);

      // Register with Homebridge
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }
  }

  /**
   * Remove accessories that are no longer present
   */
  private cleanupStaleAccessories(): void {
    // Build set of current zone unique IDs
    const currentZoneIds = new Set<string>();
    for (const zone of this.client.getZones()) {
      const uniqueId = this.debug ? `dev_${zone.uniqueId}` : zone.uniqueId;
      currentZoneIds.add(this.api.hap.uuid.generate(uniqueId));
    }

    // Find and remove stale accessories
    const staleAccessories = this.accessories.filter(acc => !currentZoneIds.has(acc.UUID));

    if (staleAccessories.length > 0) {
      this.log.info(`Removing ${staleAccessories.length} stale accessory(s)`);
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, staleAccessories);
    }
  }
}
