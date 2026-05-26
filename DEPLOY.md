# 🚀 Cómo subir la Wiki a GitHub Pages

## Paso 1: Crear el repositorio en GitHub

1. Ve a https://github.com/new
2. Nombre del repo: `plaga-wiki`
3. Déjalo **público** (GitHub Pages gratis solo funciona con repos públicos)
4. NO marques "Add README" (ya tenemos uno)
5. Click en "Create repository"

## Paso 2: Conectar y subir (copia estos comandos en tu terminal)

```bash
cd C:\Taxones\Taxones\wiki
git branch -M main
git remote add origin https://github.com/marbaezf-tech/plaga-wiki.git
git push -u origin main
```

Te va a pedir login de GitHub. Si te pide token:
- Ve a https://github.com/settings/tokens
- "Generate new token (classic)"
- Dale permisos de "repo"
- Copia el token y úsalo como contraseña

## Paso 3: Activar GitHub Pages

1. Ve a https://github.com/marbaezf-tech/plaga-wiki/settings/pages
2. En "Source" selecciona: **Deploy from a branch**
3. En "Branch" selecciona: **main** y carpeta **/ (root)**
4. Click en "Save"
5. Espera 1-2 minutos

## Paso 4: ¡Listo!

Tu wiki estará en:
**https://marbaezf-tech.github.io/plaga-wiki/**

Comparte ese link con quien quieras. Funciona 24/7 sin tu PC prendido.

## Para actualizar la wiki después:

```bash
cd C:\Taxones\Taxones\wiki
git add .
git commit -m "update: descripción del cambio"
git push
```

Los cambios se reflejan en 1-2 minutos automáticamente.
