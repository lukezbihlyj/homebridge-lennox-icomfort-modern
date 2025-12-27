<p align="left">
<a href="https://lennoxicomfort.com">
<img src="./assets/lennox-icomfort-logo.png" width="70%">
</a>
</p>

# Homebridge Lennox iComfort Modern

A [Homebridge](https://homebridge.io) plugin for Lennox iComfort S30, S40, E30, and M30 smart thermostats that use the modern [lennoxicomfort.com](https://lennoxicomfort.com) cloud API.

## Supported Devices

This plugin supports the newer Lennox iComfort systems that use the **lennoxicomfort.com** dashboard:

- **Lennox iComfort S30**
- **Lennox iComfort S40**
- **Lennox iComfort E30**
- **Lennox iComfort M30**

> **Note:** This plugin does NOT support older iComfort systems that use myicomfort.com. For those devices, see other Homebridge plugins.

## Features

- **Current Temperature** - View the current temperature from your thermostat
- **Current Humidity** - View the current humidity level
- **HVAC Mode Control** - Get/Set operating mode (Off, Heat, Cool, Auto)
- **Temperature Setpoints** - Get/Set target temperatures
- **Auto Mode Thresholds** - Independent heating and cooling thresholds for Auto mode
- **Multi-Zone Support** - Each zone appears as a separate thermostat accessory
- **Automatic Deadband** - Maintains 3°F separation between heating and cooling setpoints
- **Emergency Heat Switch** - For dual-fuel systems, an optional switch to enable emergency heat only mode

## Installation

### Via Homebridge UI (Recommended)

1. Search for `lennox-icomfort-modern` in the Homebridge UI plugin search
2. Click Install
3. Configure with your `lennoxicomfort.com` credentials

### Via Command Line

```bash
npm install -g homebridge-lennox-icomfort-modern
```

## Configuration

Add the platform to your Homebridge `config.json`:

```json
{
  "platforms": [
    {
      "platform": "LennoxIComfortModern",
      "name": "Lennox iComfort",
      "username": "your-email@example.com",
      "password": "your-password"
    }
  ]
}
```

### Configuration Options

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `username` | Yes | - | Your lennoxicomfort.com email address |
| `password` | Yes | - | Your lennoxicomfort.com password |
| `name` | No | "Lennox iComfort" | Platform name shown in logs |
| `pollInterval` | No | 10 | How often to poll for updates (seconds) |
| `temperatureUnit` | No | "auto" | Temperature display: "auto", "C", or "F" |
| `enableEmergencyHeat` | No | false | Enable emergency heat switch for dual-fuel systems |

## Running as a Child Bridge

It is recommended to run this plugin as a [child bridge](https://github.com/homebridge/homebridge/wiki/Child-Bridges) for better stability and isolation.

## Credits

This plugin is based on:

- [homebridge-lennox-icomfort](https://github.com/akgoode/homebridge-lennox-icomfort) by akgoode - the original Homebridge plugin that served as the foundation for this project
- [lennoxs30api](https://github.com/PeteRager/lennoxs30api) by Pete Rager - the Python library for the modern Lennox cloud API
- [Home Assistant Lennox S30 integration](https://github.com/PeteRager/lennoxs30) by Pete Rager - reference implementation for the S30/E30/M30 API

## License

Apache-2.0

## Feedback & Issues

Please submit any issues or feature requests to the [GitHub Issues](https://github.com/lukezbihlyj/homebridge-lennox-icomfort-modern/issues) page.
