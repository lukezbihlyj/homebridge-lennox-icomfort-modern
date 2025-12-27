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
  LennoxSystem,
  LennoxZone,
  LennoxS30Error,
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
 * LennoxS30Platform
 * Main platform plugin for Lennox S30/E30/M30 thermostats
 */
export class LennoxIComfortModernPlatform implements DynamicPlatformPlugin {
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

  // Lennox S30 API client
  public client: LennoxS30Client;

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
    this.log.info('Initializing Lennox S30 platform:', this.config.name);

    this.name = config.name;
    this.username = config.username;
    this.password = config.password;
    this.pollInterval = config.pollInterval || 10;
    this.debug = config.debugmode || false;
    this.enableEmergencyHeat = config.enableEmergencyHeat || false;

    // Temperature unit: will be set from config or auto-detected from thermostat
    this.temperatureUnit = this.Characteristic.TemperatureDisplayUnits.FAHRENHEIT;
    this.temperatureUnitConfig = config.temperatureUnit || 'auto';

    // Initialize the Lennox S30 API client
    this.client = new LennoxS30Client(
      {
        email: this.username,
        password: this.password,
        appId: config.appId,
        pollInterval: this.pollInterval,
      },
      this.log,
    );

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
  private handleZoneUpdate(system: LennoxSystem, zone: LennoxZone): void {
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
      this.log.info('Connecting to Lennox S30 cloud...');
      await this.client.serverConnect();

      // Initialize and wait for zone data
      this.log.info('Initializing systems and zones...');
      await this.client.initialize();

      // Start the message pump for ongoing updates
      this.client.startMessagePump((error) => {
        this.log.error('Message pump error:', error.message);
      });

      // Process discovered systems and zones
      for (const system of this.client.systemList) {
        this.log.info(`Processing system: ${system.name} (${system.sysId})`);

        // Set temperature unit based on config or system setting
        if (this.temperatureUnitConfig === 'C') {
          this.temperatureUnit = this.Characteristic.TemperatureDisplayUnits.CELSIUS;
          this.log.info('Temperature unit set to Celsius (from config)');
        } else if (this.temperatureUnitConfig === 'F') {
          this.temperatureUnit = this.Characteristic.TemperatureDisplayUnits.FAHRENHEIT;
          this.log.info('Temperature unit set to Fahrenheit (from config)');
        } else {
          // Auto: use thermostat's setting
          if (system.temperatureUnit === 'C') {
            this.temperatureUnit = this.Characteristic.TemperatureDisplayUnits.CELSIUS;
            this.log.info('Temperature unit set to Celsius (from thermostat)');
          } else {
            this.temperatureUnit = this.Characteristic.TemperatureDisplayUnits.FAHRENHEIT;
            this.log.info('Temperature unit set to Fahrenheit (from thermostat)');
          }
        }

        // Register each active zone as a thermostat accessory
        const activeZones = system.getActiveZones();
        this.log.info(`Found ${activeZones.length} active zone(s) in system ${system.name}`);

        for (const zone of activeZones) {
          this.registerZoneAccessory(system, zone);
        }
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
   * Register a zone as a thermostat accessory
   */
  private registerZoneAccessory(system: LennoxSystem, zone: LennoxZone): void {
    // Generate unique ID for this zone
    const uniqueId = this.debug ? `dev_${zone.uniqueId}` : zone.uniqueId;
    const uuid = this.api.hap.uuid.generate(uniqueId);

    // Build display name: "System Name - Zone Name" or just zone name if only one zone
    const displayName = system.numberOfZones > 1
      ? `${system.name} - ${zone.name}`
      : system.name;

    // Check if accessory already exists
    const existingAccessory = this.accessories.find(acc => acc.UUID === uuid);

    if (existingAccessory) {
      this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

      // Update context with latest info
      existingAccessory.context = {
        systemId: system.sysId,
        zoneId: zone.id,
        systemName: system.name,
        zoneName: zone.name,
        productType: system.productType,
      } as ZoneAccessoryContext;

      this.api.updatePlatformAccessories([existingAccessory]);

      // Create thermostat handler
      const handler = new Thermostat(this, existingAccessory, system, zone);
      this.thermostatHandlers.set(zone.uniqueId, handler);

    } else {
      this.log.info('Adding new accessory:', displayName);

      // Create new accessory
      const accessory = new this.api.platformAccessory(displayName, uuid);

      // Store context
      accessory.context = {
        systemId: system.sysId,
        zoneId: zone.id,
        systemName: system.name,
        zoneName: zone.name,
        productType: system.productType,
      } as ZoneAccessoryContext;

      // Create thermostat handler
      const handler = new Thermostat(this, accessory, system, zone);
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
    for (const system of this.client.systemList) {
      for (const zone of system.getActiveZones()) {
        const uniqueId = this.debug ? `dev_${zone.uniqueId}` : zone.uniqueId;
        currentZoneIds.add(this.api.hap.uuid.generate(uniqueId));
      }
    }

    // Find and remove stale accessories
    const staleAccessories = this.accessories.filter(acc => !currentZoneIds.has(acc.UUID));

    if (staleAccessories.length > 0) {
      this.log.info(`Removing ${staleAccessories.length} stale accessory(s)`);
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, staleAccessories);
    }
  }
}
