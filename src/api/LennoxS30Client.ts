/**
 * Lennox S30/S40/E30/M30 Cloud API Client
 * Implements authentication, message pump, and zone control
 */

import {
  LoginResponse,
  LennoxSystem,
  LennoxZone,
  PropertyChangeMessage,
  LennoxS30Config,
  ZoneData,
  MessageData,
} from './types';

import {
  CLOUD_AUTHENTICATE_URL,
  CLOUD_LOGIN_URL,
  CLOUD_RETRIEVE_URL,
  CLOUD_REQUESTDATA_URL,
  CLOUD_PUBLISH_URL,
  CERTIFICATE,
  USER_AGENT,
  LENNOX_DEFAULT_CLOUD_APP_ID,
  DEFAULT_POLL_INTERVAL,
  DEFAULT_TIMEOUT,
  TOKEN_REFRESH_BUFFER,
  EC_AUTHENTICATE,
  EC_LOGIN,
  EC_UNAUTHORIZED,
  EC_HTTP_ERR,
  EC_COMMS_ERROR,
  MESSAGE_TYPE_PROPERTY_CHANGE,
} from './constants';

/**
 * Custom error class for Lennox API errors
 */
export class LennoxS30Error extends Error {
  constructor(
    message: string,
    public errorCode: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = 'LennoxS30Error';
  }
}

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
 * Lennox S30 Cloud API Client
 */
export class LennoxS30Client {
  private email: string;
  private password: string;
  private appId: string;
  private pollInterval: number;
  private timeout: number;

  // Authentication state
  private certificateToken: string | null = null;
  private loginBearerToken: string | null = null;
  private tokenExpiry: number = 0;

  // Systems discovered
  public systems: Map<string, LennoxSystem> = new Map();

  // Callbacks for updates
  private updateCallbacks: Array<(zone: LennoxZone) => void> = [];

  // Logger
  private log: Logger;

  constructor(config: LennoxS30Config, log: Logger) {
    this.email = config.email;
    this.password = config.password;
    this.appId = config.appId || LENNOX_DEFAULT_CLOUD_APP_ID;
    this.pollInterval = (config.pollInterval || DEFAULT_POLL_INTERVAL) * 1000;
    this.timeout = DEFAULT_TIMEOUT;
    this.log = log;
  }

  /**
   * Get all systems as an array
   */
  get systemList(): LennoxSystem[] {
    return Array.from(this.systems.values());
  }

  /**
   * Get all active zones across all systems
   * Returns zones with all system info populated
   */
  getZones(): LennoxZone[] {
    const allZones: LennoxZone[] = [];
    for (const system of this.systems.values()) {
      for (const zone of system.getActiveZones()) {
        // Ensure system info is copied to zone
        zone.systemName = system.name;
        zone.productType = system.productType;
        zone.numberOfZones = system.numberOfZones;
        allZones.push(zone);
      }
    }
    return allZones;
  }

  /**
   * Register a callback for zone updates
   */
  onUpdate(callback: (zone: LennoxZone) => void): void {
    this.updateCallbacks.push(callback);
  }

  /**
   * Get the client ID for API requests
   */
  private getClientId(): string {
    return `${this.appId}_${this.email}`;
  }

  /**
   * Perform HTTP request with error handling
   */
  private async request<T>(
    url: string,
    options: RequestInit = {},
  ): Promise<{ status: number; data: T; text: string }> {
    const defaultHeaders: Record<string, string> = {
      'User-Agent': USER_AGENT,
      'Accept': '*/*',
      'Accept-Language': 'en-US;q=1',
    };

    const headers: Record<string, string> = {
      ...defaultHeaders,
      ...(options.headers as Record<string, string> || {}),
    };

    this.log.debug(`API Request: ${options.method || 'GET'} ${url}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      this.log.debug(`API Response: ${response.status} ${response.statusText}`);

      const responseText = await response.text();
      this.log.debug(`Response body length: ${responseText.length} chars`);

      let data: T = {} as T;
      if (responseText) {
        try {
          data = JSON.parse(responseText) as T;
        } catch {
          // Not JSON, that's okay for some endpoints
        }
      }

      return { status: response.status, data, text: responseText };
    } catch (error) {
      if (error instanceof Error) {
        // Log detailed error information
        this.log.error(`Fetch error - Name: ${error.name}, Message: ${error.message}`);
        const errorWithCause = error as Error & { cause?: unknown };
        if (errorWithCause.cause) {
          this.log.error(`Fetch error cause: ${JSON.stringify(errorWithCause.cause)}`);
        }

        if (error.name === 'AbortError') {
          throw new LennoxS30Error(`Request timeout after ${this.timeout}ms`, EC_COMMS_ERROR);
        }

        // Check for common Node.js fetch errors
        if (error.message.includes('ENOTFOUND')) {
          throw new LennoxS30Error(`DNS lookup failed - check your network connection`, EC_COMMS_ERROR);
        }
        if (error.message.includes('ECONNREFUSED')) {
          throw new LennoxS30Error(`Connection refused`, EC_COMMS_ERROR);
        }
        if (error.message.includes('ETIMEDOUT') || error.message.includes('ESOCKETTIMEDOUT')) {
          throw new LennoxS30Error(`Connection timed out`, EC_COMMS_ERROR);
        }
        if (error.message.includes('certificate') || error.message.includes('SSL') || error.message.includes('TLS')) {
          throw new LennoxS30Error(`SSL/TLS error: ${error.message}`, EC_COMMS_ERROR);
        }

        throw new LennoxS30Error(`Network error: ${error.message}`, EC_COMMS_ERROR);
      }
      throw new LennoxS30Error('Unknown error occurred', EC_COMMS_ERROR);
    }
  }

  /**
   * Step 1: Authenticate with certificate to get certificateToken
   */
  private async authenticate(): Promise<void> {
    this.log.info('Step 1: Authenticating with Lennox cloud...');
    this.log.debug(`Authenticate URL: ${CLOUD_AUTHENTICATE_URL}`);

    const maxRetries = 5;
    let lastError: string = '';

    for (let retry = 0; retry < maxRetries; retry++) {
      try {
        const result = await this.request<{
          serverAssigned: {
            security: {
              certificateToken: {
                encoded: string;
              };
            };
          };
        }>(CLOUD_AUTHENTICATE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
          },
          body: CERTIFICATE,
        });

        if (result.status === 200) {
          this.certificateToken = result.data.serverAssigned?.security?.certificateToken?.encoded;
          if (!this.certificateToken) {
            throw new LennoxS30Error('No certificate token in authenticate response', EC_AUTHENTICATE);
          }
          this.log.info('Certificate authentication successful');
          return;
        } else {
          lastError = `Authenticate failed - retry [${retry}] of [${maxRetries - 1}] status [${result.status}] text [${result.text}]`;
          this.log.warn(lastError);
        }
      } catch (error) {
        if (error instanceof LennoxS30Error) {
          throw error;
        }
        lastError = `Authenticate error on retry ${retry}: ${error}`;
        this.log.warn(lastError);
      }
    }

    throw new LennoxS30Error(lastError, EC_AUTHENTICATE);
  }

  /**
   * Step 2: Login with email/password to get user token
   */
  private async login(): Promise<void> {
    this.log.info('Step 2: Logging in with credentials...');
    this.log.debug(`Login URL: ${CLOUD_LOGIN_URL}`);
    this.log.debug(`Email: ${this.email}`);
    this.log.debug(`App ID: ${this.appId}`);

    if (!this.certificateToken) {
      throw new LennoxS30Error('No certificate token - authenticate first', EC_LOGIN);
    }

    // Body is form-urlencoded (as plain text)
    const body = `username=${encodeURIComponent(this.email)}&password=${encodeURIComponent(this.password)}&grant_type=password&applicationid=${encodeURIComponent(this.appId)}`;

    this.log.debug(`Login body (redacted): username=${this.email}&password=***&grant_type=password&applicationid=${this.appId}`);

    try {
      const result = await this.request<LoginResponse>(CLOUD_LOGIN_URL, {
        method: 'POST',
        headers: {
          'Authorization': this.certificateToken,
          'Content-Type': 'text/plain',
        },
        body,
      });

      if (result.status !== 200) {
        throw new LennoxS30Error(
          `Login failed - status [${result.status}] response [${result.text}]`,
          EC_LOGIN,
          result.status,
        );
      }

      this.log.debug('Login response received, processing...');
      this.processLoginResponse(result.data);
      this.log.info('Login successful');
    } catch (error) {
      this.log.error(`Login error: ${error}`);
      if (error instanceof LennoxS30Error) {
        throw error;
      }
      throw new LennoxS30Error(`Login failed: ${error}`, EC_LOGIN);
    }
  }

  /**
   * Connect to the Lennox cloud API (authenticate + login)
   */
  async serverConnect(): Promise<void> {
    // Step 1: Authenticate with certificate
    await this.authenticate();

    // Step 2: Login with email/password
    await this.login();

    this.log.info('Successfully connected to Lennox cloud API');
  }

  /**
   * Process the login response
   */
  private processLoginResponse(response: LoginResponse): void {
    // Extract token information
    const security = response.ServerAssignedRoot?.serverAssigned?.security;
    if (!security?.userToken) {
      this.log.error(`Login response missing userToken. Response keys: ${JSON.stringify(Object.keys(response))}`);
      throw new LennoxS30Error('No user token in login response', EC_LOGIN);
    }

    this.loginBearerToken = security.userToken.encoded;
    this.tokenExpiry = security.userToken.expiryTime;

    this.log.debug(`Token expires at: ${new Date(this.tokenExpiry * 1000).toISOString()}`);

    // Process homes and systems
    const homes = response.readyHomes?.homes || [];
    this.log.info(`Found ${homes.length} home(s)`);

    for (const home of homes) {
      this.log.debug(`Processing home: ${home.name} (${home.homeId})`);
      for (const homeSystem of home.systems) {
        const system = new LennoxSystem(homeSystem.sysId, home.name);
        this.systems.set(homeSystem.sysId, system);
        this.log.info(`Discovered system: ${homeSystem.sysId} in home: ${home.name}`);

        // Set initial cloud status from presence
        if (response.myPresence) {
          system.cloudStatus = response.myPresence[homeSystem.sysId] || 'unknown';
          this.log.debug(`System ${homeSystem.sysId} cloud status: ${system.cloudStatus}`);
        }
      }
    }
  }

  /**
   * Check if token needs refresh
   */
  private needsTokenRefresh(): boolean {
    const now = Date.now() / 1000;
    return now >= (this.tokenExpiry - TOKEN_REFRESH_BUFFER);
  }

  /**
   * Refresh the authentication token by re-authenticating
   */
  async refreshAuthToken(): Promise<void> {
    this.log.debug('Refreshing authentication token...');
    await this.serverConnect();
    this.log.debug('Token refreshed successfully');
  }

  /**
   * Generate a new message ID (UUID v4)
   */
  private getNewMessageId(): string {
    // Simple UUID v4 implementation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Request data from the system with specific JSONPath
   */
  async requestData(system: LennoxSystem, jsonPath: string): Promise<void> {
    if (!this.loginBearerToken) {
      throw new LennoxS30Error('Not logged in', EC_UNAUTHORIZED);
    }

    const requestBody = {
      MessageType: 'RequestData',
      SenderID: this.getClientId(),
      MessageID: this.getNewMessageId(),
      TargetID: system.sysId,
      AdditionalParameters: {
        JSONPath: jsonPath,
      },
    };

    this.log.debug(`Requesting data for system ${system.sysId}: ${jsonPath}`);

    const result = await this.request<unknown>(
      CLOUD_REQUESTDATA_URL,
      {
        method: 'POST',
        headers: {
          'Authorization': this.loginBearerToken,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(requestBody),
      },
    );

    if (result.status !== 200) {
      throw new LennoxS30Error(
        `RequestData failed - status [${result.status}] response [${result.text}]`,
        EC_COMMS_ERROR,
        result.status,
      );
    }
  }

  /**
   * Subscribe to updates for a system - requests all relevant data
   */
  async subscribe(system: LennoxSystem): Promise<void> {
    this.log.debug(`Subscribing to system: ${system.sysId}`);

    if (!this.loginBearerToken) {
      throw new LennoxS30Error('Not logged in', EC_UNAUTHORIZED);
    }

    try {
      // First request: main system data including zones
      await this.requestData(
        system,
        '1;/systemControl;/systemController;/reminderSensors;/reminders;/alerts/active;/alerts/meta;/devices;/zones;/equipments;/schedules;/occupancy;/system',
      );

      // Second request: additional data
      await this.requestData(
        system,
        '1;/homes;/interfaces',
      );

      this.log.info(`Subscribed to system: ${system.sysId}`);
    } catch (error) {
      this.log.error(`Failed to subscribe to system ${system.sysId}: ${error}`);
      throw error;
    }
  }

  /**
   * Poll for messages (message pump)
   */
  async messagePump(): Promise<boolean> {
    // Check if we need to refresh the token
    if (this.needsTokenRefresh()) {
      await this.refreshAuthToken();
    }

    if (!this.loginBearerToken) {
      throw new LennoxS30Error('Not logged in', EC_UNAUTHORIZED);
    }

    try {
      // Build URL with query parameters
      const params = new URLSearchParams({
        Direction: 'Oldest-to-Newest',
        MessageCount: '10',
        StartTime: '1',
        LongPollingTimeout: '0',  // No long polling for cloud
      });

      const url = `${CLOUD_RETRIEVE_URL}?${params.toString()}`;

      const result = await this.request<{ messages: PropertyChangeMessage[] }>(
        url,
        {
          method: 'GET',
          headers: {
            'Authorization': this.loginBearerToken,
          },
        },
      );

      if (result.status === 200) {
        const messages = result.data?.messages || [];
        if (messages.length === 0) {
          return false;
        }

        this.log.debug(`Received ${messages.length} message(s)`);

        for (const message of messages) {
          // Find the system this message is for
          const senderId = message.SenderID || message.SenderId;
          if (senderId) {
            const system = this.systems.get(senderId);
            if (system) {
              this.processMessage(message, system);
            } else {
              this.log.debug(`Received message for unknown system: ${senderId}`);
            }
          }
        }
        return true;
      } else if (result.status === 204) {
        // No content - no messages available
        return false;
      } else if (result.status === 401) {
        throw new LennoxS30Error('Unauthorized - token may have expired', EC_UNAUTHORIZED, 401);
      } else {
        this.log.warn(`Message pump received status ${result.status}`);
        return false;
      }
    } catch (error) {
      if (error instanceof LennoxS30Error && error.errorCode === EC_UNAUTHORIZED) {
        throw error;
      }
      this.log.error(`Message pump error: ${error}`);
      return false;
    }
  }

  /**
   * Process a message from the API
   */
  private processMessage(message: PropertyChangeMessage, system: LennoxSystem): void {
    // Check if message has Data - don't filter on MessageType
    const data = message.Data;
    if (!data) {
      this.log.debug(`Message has no Data field: ${JSON.stringify(message).substring(0, 200)}`);
      return;
    }

    this.log.debug(`Processing message with keys: ${Object.keys(data).join(', ')}`);

    // Process system data
    if (data.system) {
      this.log.debug('Processing system data');
      if ((data.system as any).config) {
        system.updateFromConfig((data.system as any).config);
      }
      if ((data.system as any).status) {
        system.updateFromStatus((data.system as any).status);
      }
      if ((data.system as any).time) {
        system.updateFromTime((data.system as any).time);
      }
    }

    // Process zones data
    if (data.zones && Array.isArray(data.zones)) {
      this.log.debug(`Processing ${data.zones.length} zone(s)`);
      this.processZonesData(system, data.zones);
    }
  }

  /**
   * Process zones data from a message
   */
  private processZonesData(system: LennoxSystem, zones: ZoneData[]): void {
    for (const zoneData of zones) {
      const zone = system.getOrCreateZone(zoneData.id);
      zone.updateFromData(zoneData);

      // Copy system info to zone for interface compatibility
      zone.systemName = system.name;
      zone.productType = system.productType;
      zone.numberOfZones = system.numberOfZones;

      // Notify callbacks of zone updates
      if (zone.isActive()) {
        for (const callback of this.updateCallbacks) {
          try {
            callback(zone);
          } catch (error) {
            this.log.error(`Update callback error: ${error}`);
          }
        }
      }
    }
  }

  /**
   * Publish a command to a system
   */
  async publish(systemId: string, data: MessageData): Promise<void> {
    if (!this.loginBearerToken) {
      throw new LennoxS30Error('Not logged in', EC_UNAUTHORIZED);
    }

    const publishData = {
      MessageType: 'Command',
      SenderID: this.getClientId(),
      TargetID: systemId,
      Data: data,
    };

    const result = await this.request(
      CLOUD_PUBLISH_URL,
      {
        method: 'POST',
        headers: {
          'Authorization': this.loginBearerToken,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(publishData),
      },
    );

    if (result.status !== 200) {
      throw new LennoxS30Error(
        `Publish failed - status [${result.status}] response [${result.text}]`,
        EC_COMMS_ERROR,
        result.status,
      );
    }
  }

  /**
   * Set HVAC mode for a zone
   * This sends to the schedule (manual mode) as required by the Lennox API
   */
  async setHVACMode(zone: LennoxZone, mode: string): Promise<void> {
    this.log.info(`Setting HVAC mode for zone ${zone.name} to ${mode}`);

    // Use manual mode schedule ID
    const scheduleId = this.getManualModeScheduleId(zone);

    // The Lennox API expects mode changes to be sent to a schedule
    const data = {
      schedules: [{
        id: scheduleId,
        schedule: {
          periods: [{
            id: 0,
            period: {
              systemMode: mode,
            },
          }],
        },
      }],
    };

    await this.publish(zone.systemId, data as unknown as MessageData);
  }

  /**
   * Convert Fahrenheit to Celsius
   */
  private fToC(f: number): number {
    return Math.round((f - 32) * 5 / 9 * 10) / 10;
  }

  /**
   * Get the manual mode schedule ID for a zone
   * Manual mode schedules start at 16, so zone 0 = schedule 16, zone 1 = schedule 17, etc.
   */
  private getManualModeScheduleId(zone: LennoxZone): number {
    return 16 + zone.id;
  }

  /**
   * Set temperature setpoints for a zone
   * This sends to the schedule (manual mode) as required by the Lennox API
   */
  async setTemperature(
    zone: LennoxZone,
    options: {
      hsp?: number;
      csp?: number;
    },
  ): Promise<void> {
    this.log.info(`Setting temperature for zone ${zone.name}:`, options);

    // Build the period data with both F and C values
    const period: Record<string, unknown> = {};

    if (options.hsp !== undefined) {
      period.hsp = Math.round(options.hsp);
      period.hspC = this.fToC(options.hsp);
    }
    if (options.csp !== undefined) {
      period.csp = Math.round(options.csp);
      period.cspC = this.fToC(options.csp);
    }

    // Use manual mode schedule ID
    const scheduleId = this.getManualModeScheduleId(zone);

    // The Lennox API expects setpoints to be sent to a schedule, not directly to the zone
    const data = {
      schedules: [{
        id: scheduleId,
        schedule: {
          periods: [{
            id: 0,
            period: period,
          }],
        },
      }],
    };

    await this.publish(zone.systemId, data as unknown as MessageData);
  }

  /**
   * Set fan mode for a zone
   * This sends to the schedule (manual mode) as required by the Lennox API
   */
  async setFanMode(zone: LennoxZone, mode: string): Promise<void> {
    this.log.info(`Setting fan mode for zone ${zone.name} to ${mode}`);

    // Use manual mode schedule ID
    const scheduleId = this.getManualModeScheduleId(zone);

    // The Lennox API expects mode changes to be sent to a schedule
    const data = {
      schedules: [{
        id: scheduleId,
        schedule: {
          periods: [{
            id: 0,
            period: {
              fanMode: mode,
            },
          }],
        },
      }],
    };

    await this.publish(zone.systemId, data as unknown as MessageData);
  }

  /**
   * Initialize all systems - subscribe and wait for initial data
   */
  async initialize(): Promise<void> {
    // Subscribe to all systems
    for (const system of this.systems.values()) {
      await this.subscribe(system);
    }

    // Wait for zone configuration with timeout
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      let allSystemsReady = true;

      for (const system of this.systems.values()) {
        const activeZones = system.getActiveZones();
        if (activeZones.length === 0) {
          allSystemsReady = false;
          break;
        }
      }

      if (allSystemsReady) {
        this.log.info('All systems initialized with zone data');
        return;
      }

      // Poll for more data
      await this.messagePump();
      await this.sleep(1000);
    }

    this.log.warn('Timeout waiting for zone configuration');
  }

  /**
   * Helper to sleep for a duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Start the message pump loop
   */
  async startMessagePump(onError?: (error: Error) => void): Promise<void> {
    this.log.info('Starting message pump...');

    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 5;

    const pump = async () => {
      while (true) {
        try {
          await this.messagePump();
          consecutiveErrors = 0; // Reset on success
        } catch (error) {
          consecutiveErrors++;

          if (error instanceof LennoxS30Error && error.errorCode === EC_UNAUTHORIZED) {
            // Token expired - need to reconnect
            this.log.warn('Token expired, reconnecting...');
            try {
              await this.serverConnect();
              for (const system of this.systems.values()) {
                await this.subscribe(system);
              }
              consecutiveErrors = 0;
              this.log.info('Reconnected successfully');
            } catch (reconnectError) {
              this.log.error(`Reconnect failed: ${reconnectError}`);
            }
          } else if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            // Too many errors - try full reconnect
            this.log.warn(`${consecutiveErrors} consecutive errors, attempting reconnect...`);
            try {
              await this.serverConnect();
              for (const system of this.systems.values()) {
                await this.subscribe(system);
              }
              consecutiveErrors = 0;
              this.log.info('Reconnected successfully after errors');
            } catch (reconnectError) {
              this.log.error(`Reconnect failed: ${reconnectError}`);
            }
          } else {
            // Transient error - just log and continue
            this.log.debug(`Message pump error (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}): ${error}`);
          }

          if (onError && error instanceof Error) {
            onError(error);
          }
        }
        await this.sleep(this.pollInterval);
      }
    };

    // Run in background
    pump().catch(error => {
      this.log.error(`Fatal message pump error: ${error}`);
    });
  }

  /**
   * Shutdown the client
   */
  async shutdown(): Promise<void> {
    this.log.info('Shutting down Lennox S30 client');
    this.certificateToken = null;
    this.loginBearerToken = null;
    this.systems.clear();
  }
}
