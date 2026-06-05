# 06 — VS Code: Extensiones y Settings

## Extensiones Esenciales

### Para Godot/GDScript
```bash
code --install-extension geequlim.godot-tools    # Intellisense GDScript
code --install-extension alfish.godot-files      # Soporte .tscn/.tres
```

### Productividad
```bash
code --install-extension usernamehw.errorlens                  # Errores inline
code --install-extension gruntfuggly.todo-tree                 # Panel TODOs
code --install-extension christian-kohler.path-intellisense    # Autocompletar rutas
code --install-extension streetsidesoftware.code-spell-checker # Corrector ortográfico
```

### Git
```bash
code --install-extension eamodio.gitlens         # Git blame, historial
code --install-extension mhutchie.git-graph      # Árbol visual de branches
```

### Markdown/Escritura
```bash
code --install-extension yzhang.markdown-all-in-one              # Preview, TOC
code --install-extension bierner.markdown-preview-github-styles  # Estilo GitHub
```

### Datos
```bash
code --install-extension redhat.vscode-yaml      # YAML intellisense
code --install-extension mechatroner.rainbow-csv  # CSV con colores
```

### Visual
```bash
code --install-extension pkief.material-icon-theme   # Iconos bonitos
```

### IA
```bash
code --install-extension continue.continue       # IA local con Ollama
```

## Settings Recomendadas

Archivo: `%APPDATA%\Code\User\settings.json`

```json
{
    "editor.fontSize": 14,
    "editor.fontFamily": "'Cascadia Code', Consolas, monospace",
    "editor.fontLigatures": true,
    "editor.tabSize": 4,
    "editor.wordWrap": "on",
    "editor.bracketPairColorization.enabled": true,
    "editor.guides.bracketPairs": "active",
    "editor.smoothScrolling": true,
    "editor.cursorSmoothCaretAnimation": "on",
    "editor.stickyScroll.enabled": true,
    "editor.formatOnSave": true,
    "editor.formatOnPaste": true,

    "files.autoSave": "afterDelay",
    "files.autoSaveDelay": 2000,
    "files.trimTrailingWhitespace": true,
    "files.insertFinalNewline": true,
    "files.exclude": {
        "**/.godot": true,
        "**/node_modules": true,
        "**/__pycache__": true
    },

    "terminal.integrated.fontSize": 13,
    "terminal.integrated.scrollback": 5000,

    "workbench.iconTheme": "material-icon-theme",
    "workbench.editor.enablePreview": false,

    "git.autofetch": true,
    "git.enableSmartCommit": true,

    "cSpell.language": "es,en",

    "continue.enableTabAutocomplete": false
}
```

## Godot Tools — Configuración

La extensión Godot Tools necesita que Godot esté abierto para funcionar:

1. Abrí tu proyecto en VS Code
2. VS Code pide la ruta al ejecutable de Godot → seleccionalo
3. Abrí Godot con el mismo proyecto
4. VS Code se conecta al Language Server de Godot (puerto 6008)

Con esto tenés: autocompletado GDScript, go-to-definition, errores en tiempo real.

## Tips

- `Ctrl+Shift+P` → Command Palette (buscar cualquier comando)
- `Ctrl+P` → Abrir archivo rápido
- `Ctrl+Shift+F` → Buscar en todos los archivos
- `Ctrl+`` → Toggle terminal
- `Alt+↑/↓` → Mover línea arriba/abajo
- `Ctrl+Shift+D` → Duplicar línea
