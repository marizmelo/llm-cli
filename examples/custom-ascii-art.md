# Custom ASCII Art Feature

The LLM-CLI now supports custom ASCII art for the header! You can personalize your CLI experience by setting your own ASCII art logo.

## How to Use

### 1. Via Settings Dialog
1. Start the CLI: `gemini`
2. Type `/settings` to open the settings dialog
3. Navigate to the "UI" section
4. Find "Custom ASCII Art" and enter your custom art

### 2. Via Settings File
Edit your `~/.gemini/settings.json` file:

```json
{
  "ui": {
    "customAsciiArt": "Your custom ASCII art here"
  }
}
```

## Examples

### Simple Text Logo
```json
{
  "ui": {
    "customAsciiArt": "╔══════════════════════════════════╗\n║     Welcome to My Custom CLI!     ║\n║         🚀 Let's Code! 🚀         ║\n╚══════════════════════════════════╝"
  }
}
```

### ASCII Art Logo
```json
{
  "ui": {
    "customAsciiArt": "  ╭─────────────────────────────╮\n  │  ██╗     ██╗██╗  ██╗██╗     │\n  │  ██║     ██║██║ ██╔╝██║     │\n  │  ██║ █████║█████╔╝ ██║     │\n  │  ██║╚════██║██╔═██╗ ██║     │\n  │  ██║     ██║██║  ██╗██║     │\n  │  ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝     │\n  ╰─────────────────────────────╯"
  }
}
```

### Minimalist Design
```json
{
  "ui": {
    "customAsciiArt": "┌─────────────────────────┐\n│      LLM-CLI v2.0      │\n│   Multi-Provider AI    │\n└─────────────────────────┘"
  }
}
```

## Tips

- **Width**: Keep your ASCII art within reasonable width limits (80-120 characters)
- **Height**: 3-8 lines work best for most terminals
- **Characters**: Use Unicode box-drawing characters for better appearance
- **Empty**: Leave the setting empty to use the default LLM-CLI logo

## Reset to Default

To return to the default logo, either:
- Delete the `customAsciiArt` setting from your settings file
- Set it to an empty string: `"customAsciiArt": ""`

## Default Logo

When no custom ASCII art is set, the CLI displays the default LLM-CLI logo:

```
░▒▓█▓▒░      ░▒▓█▓▒░      ░▒▓██████████████▓▒░ ░▒▓██████▓▒░░▒▓█▓▒░      ░▒▓█▓▒░ 
░▒▓█▓▒░      ░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░ 
░▒▓█▓▒░      ░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░      ░▒▓█▓▒░ 
░▒▓█▓▒░      ░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░      ░▒▓█▓▒░ 
░▒▓█▓▒░      ░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░      ░▒▓█▓▒░ 
░▒▓█▓▒░      ░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░ 
░▒▓████████▓▒░▒▓████████▓▒░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓██████▓▒░░▒▓████████▓▒░▒▓█▓▒░ 
```
