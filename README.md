<p align="left">
<a href="https://lennoxicomfort.com">
<img src="./assets/lennox-icomfort-logo.png" width="70%">
</a>
</p>

# Homebridge Lennox iComfort

A [Homebridge](https://homebridge.io) plugin for Lennox iComfort smart thermostats. Supports both older iComfort Wifi models and newer S30/S40/E30/M30 systems.

## Supported Devices

### Lennox iComfort S30/S40/E30/M30 (Newer Models)
- Uses **lennoxicomfort.com** for cloud connectivity
- Multi-zone support
- Emergency heat control (dual-fuel systems)

### Lennox iComfort Wifi (Older Models)
- Uses **myicomfort.com** for cloud connectivity
- Multi-zone support (if your system has multiple zones)

## Features

| Feature | Wifi | S30/E30/M30 |
|---------|------|-------------|
| Current Temperature | ✅ | ✅ |
| Current Humidity | ✅ | ✅ |
| HVAC Mode Control (Off/Heat/Cool/Auto) | ✅ | ✅ |
| Temperature Setpoints | ✅ | ✅ |
| Auto Mode Thresholds | ✅ | ✅ |
| Automatic 3°F Deadband | ✅ | ✅ |
| Multi-Zone Support | ✅ | ✅ |
| Emergency Heat Switch | ❌ | ✅ |

## Installation

### Via Homebridge UI (Recommended)

1. Search for `lennox-icomfort-modern` in the Homebridge UI plugin search
2. Click Install
3. Select your device type (Wifi or S30/E30/M30)
4. Configure with your iComfort account credentials

### Via Command Line

```bash
npm install -g homebridge-lennox-icomfort-modern
```

## Configuration

Add the platform to your Homebridge `config.json`:

### For S30/S40/E30/M30 (default)

```json
{
  "platforms": [
    {
      "platform": "LennoxIComfortModern",
      "name": "Lennox iComfort",
      "deviceType": "s30",
      "username": "your-email@example.com",
      "password": "your-password"
    }
  ]
}
```

### For iComfort Wifi

```json
{
  "platforms": [
    {
      "platform": "LennoxIComfortModern",
      "name": "Lennox iComfort",
      "deviceType": "wifi",
      "username": "your-email@example.com",
      "password": "your-password"
    }
  ]
}
```

### Configuration Options

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `deviceType` | No | "s30" | Device type: "wifi" or "s30" |
| `username` | Yes | - | Your iComfort account email address |
| `password` | Yes | - | Your iComfort account password |
| `name` | No | "Lennox iComfort" | Platform name shown in logs |
| `pollInterval` | No | 10 (s30) / 30 (wifi) | How often to poll for updates (seconds) |
| `temperatureUnit` | No | "auto" | Temperature display: "auto", "C", or "F" |
| `enableEmergencyHeat` | No | false | (S30 only) Enable emergency heat switch for dual-fuel systems |

## Running as a Child Bridge

It is recommended to run this plugin as a [child bridge](https://github.com/homebridge/homebridge/wiki/Child-Bridges) for better stability and isolation.

## Credits

This plugin is based on:

- [homebridge-lennox-icomfort](https://github.com/akgoode/homebridge-lennox-icomfort) by akgoode - the original Homebridge plugin that served as the foundation for this project
- [icomfort](https://www.npmjs.com/package/icomfort) - the npm package for the Wifi API
- [lennoxs30api](https://github.com/PeteRager/lennoxs30api) by Pete Rager - the Python library for the modern Lennox cloud API
- [Home Assistant Lennox S30 integration](https://github.com/PeteRager/lennoxs30) by Pete Rager - reference implementation for the S30/E30/M30 API

## License

Apache-2.0

## Feedback & Issues

Please submit any issues or feature requests to the [GitHub Issues](https://github.com/lukezbihlyj/homebridge-lennox-icomfort-modern/issues) page.
