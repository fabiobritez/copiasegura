# Copia Segura

Herramienta web para tapar los datos sensibles de un documento de identidad antes de compartirlo, y
dejar constancia de a quién se envía la copia.

Todo el procesamiento ocurre en el navegador. La imagen nunca se transmite, y cualquiera puede
comprobarlo: esa comprobabilidad es la razón por la que el proyecto existe.

## Qué hace

1. Encuadra y endereza la foto, marcando las cuatro esquinas del documento.
2. Tapa las zonas que marques, de forma irreversible.
3. Agrega una marca de agua con destinatario, propósito y un código que identifica la copia.
4. Descarga un archivo nuevo, sin metadatos ni rastro del original.

## Por qué se puede verificar

Cualquier sitio puede afirmar que procesa los datos localmente. Es lo que diría también uno
malicioso. Acá:

- **El código que se sirve es el que se lee.** Sin empaquetador ni minificación.
- **Funciona sin conexión.** Si procesa el documento con la red cortada, no pudo subirlo.
- **Lo impone el navegador.** CSP con `default-src 'self'` y `connect-src 'none'`.
- **Cero recursos de terceros.** Sin analítica, sin cookies, sin CDN, sin tipografías remotas.

## Usarlo sin internet

Es la forma más segura y no depende de que este sitio siga existiendo:

1. Descargar el repositorio (**Code** y luego **Download ZIP**) y descomprimirlo.
2. Abrir `index.html` con doble clic.

Verificar hoy que un sitio no sube datos no dice nada sobre lo que se despliegue mañana. Una copia
local ya auditada no cambia sola.

## Documentación

El sitio está publicado en **[copiasegura.com.ar](https://copiasegura.com.ar)**, e incluye tres
páginas con diagramas y fuentes citadas que se leen mejor ahí que desde GitHub:
[cómo funciona](https://copiasegura.com.ar/como-funciona.html),
[cómo verificarlo](https://copiasegura.com.ar/verificacion.html) y
[términos](https://copiasegura.com.ar/terminos.html).

En el repositorio:

| Documento | Contenido |
|---|---|
| [ARQUITECTURA.md](docs/ARQUITECTURA.md) | Las decisiones de diseño y su fundamentación |
| [OFUSCACION.md](docs/OFUSCACION.md) | Por qué el desenfoque y el pixelado no sirven, y qué sí |
| [DOCUMENTOS.md](docs/DOCUMENTOS.md) | Qué contiene el DNI argentino y qué conviene tapar |

Dos conclusiones que conviene conocer antes de usar la herramienta:

- **Lo primero a tapar es el código de barras, no el número impreso.** El PDF417 contiene en texto
  plano el número de trámite, el nombre, el número de DNI y la fecha de nacimiento.
- **Tapar de más también es un problema.** Si la copia queda inservible para el trámite, se la
  rechazan y la persona termina enviando el documento entero sin proteger.

## Desarrollo

No hay build, ni dependencias, ni gestores de paquetes: es HTML, CSS y JavaScript. Se edita con
cualquier editor y se prueba abriendo `index.html`. Para el service worker hace falta servirlo por
HTTP, con cualquier servidor estático.

Quien lo publique en otro lado necesita configurar las cabeceras en su servidor: la garantía la
impone el navegador, y sin ellas el sitio funciona pero deja de ser comprobable. La que importa es
`Content-Security-Policy` con `connect-src 'none'` en los HTML, que bloquea `fetch`,
`XMLHttpRequest`, `sendBeacon`, WebSocket y EventSource. `sw.js` es la excepción: necesita
`connect-src 'self'` para cachear los archivos, o se rompe el modo sin conexión.

Ver [CONTRIBUTING.md](CONTRIBUTING.md) y [SECURITY.md](SECURITY.md).

## Reconocimientos

La idea no es original del proyecto. **[Safe ID](https://github.com/Xyborg/datosargentinos.com)** de
[Martin Aberastegue](https://www.martinaberastegue.com) popularizó este caso de uso en Argentina, y
**[Saferlayer](https://saferlayer.com)** es el antecedente internacional. El código de Copia Segura
no deriva de ninguno de ellos.

## Licencia

Copyright (C) 2026 Fabio Britez

Software libre bajo la [Licencia Pública General Affero de GNU](LICENSE), versión 3 o posterior. Se
distribuye SIN NINGUNA GARANTÍA. En términos prácticos: se puede usar, modificar y hostear
libremente, y quien ofrezca una versión modificada como servicio web tiene que publicar su código.

El **nombre** "Copia Segura" no está cubierto por la licencia, según [TRADEMARK.md](TRADEMARK.md).
Ver también los [términos de uso](TERMINOS.md).
