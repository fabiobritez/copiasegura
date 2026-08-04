# Arquitectura y decisiones de diseño

Este documento explica **por qué** el proyecto está construido como está. Cada decisión responde a
una de estas dos preguntas:

1. *¿El usuario puede verificar por su cuenta que su documento no sale de su dispositivo?*
2. *¿Lo que la herramienta destruye, queda destruido de verdad?*

El análisis detallado de la segunda pregunta (qué técnicas son reversibles, qué fugas laterales
existen y cómo se cierran) vive en [OFUSCACION.md](OFUSCACION.md).

---

## Decisión 1. Sin bundler, sin minificación, sin build step

**La más importante del proyecto.**

La propuesta de valor de Copia Segura no es "procesamos tu DNI localmente". Eso lo dice cualquiera.
Es *"podés comprobar que lo procesamos localmente"*. Esa diferencia es el producto entero.

Un bundle minificado destruye esa propiedad. Un usuario que abre un `index-D4f8x.js` de 200 KB en
una sola línea no puede auditar nada, y tampoco puede saber si ese bundle corresponde al código del
repositorio: para eso harían falta builds reproducibles, difíciles de lograr y más difíciles de
explicar.

**Entonces: el código que se sirve es el código que se lee.** Archivos separados, sin transpilar,
sin minificar, sin `node_modules`.

```
El usuario abre DevTools → Sources → ve exactamente los mismos archivos que hay en GitHub.
```

**Scripts clásicos, no módulos ES.** Los navegadores bloquean los módulos por CORS sobre `file://`,
así que con módulos haría falta levantar un servidor local para usar la herramienta descargada. Con
scripts clásicos alcanza con descargar la carpeta y hacer doble clic en `index.html`. Se pierde el
aislamiento de ámbito de los módulos y se gana que la copia local, la modalidad de máxima confianza
porque no depende de ningún servidor, funcione sin instalar nada. Para una herramienta cuya premisa
es "no dependas de nadie", esa es la contrapartida correcta. El orden de carga está declarado en
cada página HTML y sigue las dependencias.

**Corolario sobre dependencias:** ninguna. Ni en el navegador ni para desarrollar: no hay build, no
hay `npm install`, no hay scripts en otros lenguajes. Todo el proyecto es HTML, CSS y JavaScript.

## Decisión 2. Solo técnicas de ofuscación irreversibles, sin excepciones estéticas

El proceso de ocultamiento ofrece únicamente técnicas donde el valor de cada píxel de salida es
**independiente del contenido tapado**:

- **Relleno sólido** (opción por defecto): la zona se sobreescribe con un color constante.
- **Relleno con ruido**: la zona se sobreescribe con ruido de `crypto.getRandomValues()`. Es
  estéticamente más suave y exactamente igual de seguro, *porque el ruido no deriva de los píxeles
  originales*.

Desenfoque y pixelado no forman parte del código, ni siquiera como opción con advertencia: una
opción insegura con un cartel es una trampa para el usuario apurado, que es exactamente el usuario
que hay que proteger. El desenfoque es atacable por deconvolución y por diccionario (renderizar
candidatos, desenfocarlos y comparar), y el pixelado retiene promedios del contenido real que
herramientas públicas reconstruyen. El detalle está en [OFUSCACION.md](OFUSCACION.md).

**Regla verificable leyendo `redact.js`:** ninguna función de ocultamiento lee los píxeles que va a
tapar. Si una función de ocultamiento llama a `getImageData` sobre su propia zona, es un bug de
seguridad.

## Decisión 3. Todo destructivo sobre el bitmap maestro, nunca superpuesto

Cada operación modifica los píxeles reales del **canvas maestro a resolución nativa**. Nunca un
elemento posicionado encima, nunca un filtro CSS, nunca una anotación sobre la vista previa.

La UI muestra una vista escalada, pero es solo un espejo: las coordenadas se transforman y la
operación se aplica al bitmap maestro. Esto cierra el bug clásico de las herramientas de este tipo
(tapar sobre la preview de 800 px y exportar el original de 4000 px con el dato intacto).

Corolario: el historial de "deshacer" vive **solo en memoria** y se descarta al terminar. No se
persiste en `localStorage` ni en IndexedDB, porque un historial persistido sería una copia sin
ofuscar del documento guardada en disco.

## Decisión 4. El archivo exportado nace del canvas, nunca del archivo original

El export es siempre un re-encode completo desde el buffer de píxeles (`canvas.toBlob`). Jamás se
reutiliza, recorta o "edita" el archivo que subió el usuario. Esto elimina de raíz una familia
entera de fugas:

- **EXIF y thumbnail embebido**: geolocalización, modelo de cámara, fecha, y la miniatura JPEG que
  muchas cámaras incrustan, que sobrevive a ediciones ingenuas mostrando la imagen *sin* tapar.
  El re-render no los copia.
- **Datos residuales tipo aCropalypse**: los bugs de Pixel Markup y Snipping Tool (2023) filtraron
  contenido recortado porque sobreescribían el archivo original dejando los bytes sobrantes al
  final. Un archivo generado de cero no puede contenerlos.
- **Nombre de archivo**: el original (`IMG_20260802_WhatsApp_Juan.jpg`) es metadato. El export usa
  siempre un nombre genérico: `copia-segura_AAAA-MM-DD.png`.

Formato por defecto: PNG. JPEG opcional para reducir tamaño, sin costo de seguridad: el ocultamiento
ocurre antes del encode, así que la compresión no la debilita.

## Decisión 5. La marca de agua es también una firma de rastreo

La marca de agua cumple dos funciones:

1. **Disuasión y limitación de uso**: texto visible con destinatario, propósito y fecha.
2. **Identificación de la copia si se filtra**: cada export lleva un **código de copia**, un
   `SHA-256(destinatario | propósito | fecha)` truncado, calculado localmente con SubtleCrypto e
   impreso de forma visible en el patrón. Si la imagen aparece donde no debía, el usuario recalcula
   los códigos de las copias que emitió e identifica cuál se filtró, incluso si quien filtró
   recortó el texto grande con el nombre del destinatario.

Reglas del patrón:

- **En mosaico diagonal sobre todo el documento**, con superposición deliberada sobre las zonas de
  valor (fotografía, campos de datos, MRZ). Removerla tiene que implicar degradar lo que hace útil
  al documento.
- Opacidad calibrada: visible y persistente, sin impedir la legibilidad de los datos que el trámite
  necesita.
- **Sin esteganografía como garantía.** Una marca LSB oculta no sobrevive recompresión ni captura
  de pantalla, y prometer rastreo invisible daría una falsa seguridad. Todo lo que el proyecto
  garantiza es visible y explicable. Los límites de la marca visible están en
  [OFUSCACION.md](OFUSCACION.md).

## Decisión 6. Recomendaciones y marcado manual, sin detección automática

La herramienta no asume DNI argentino: asume *documentos*. Y no propone rectángulos, sino que
**explica qué tapar para que la persona marque**.

Las dos alternativas automáticas quedan descartadas por sus propias limitaciones (el detalle está
en [DOCUMENTOS.md](DOCUMENTOS.md), sección 4):

- **Coordenadas fijas por plantilla:** inviables. Circulan al menos siete series del DNI argentino
  con layouts distintos, la de 2023 cambió el PDF417 por un QR, y las fuentes públicas se
  contradicen sobre en qué cara está cada elemento.
- **Detección automática por firma visual:** funciona muy bien contra códigos sintéticos y falla
  con fotos reales, por reflejos del holograma, perspectiva, enfoque parcial y luz de interior.

El argumento decisivo es el mismo en los dos casos: **una propuesta automática que falla es peor
que ninguna.** El usuario apurado confirma el rectángulo sin mirar y se queda tranquilo, y un dato
sensible que la persona *cree* cubierto y no lo está es el peor error posible de esta herramienta.

Lo que sí hace `js/templates.js` es dar una guía en dos listas, **tapar** y **dejar visible**, con
un criterio que no es "qué dato es sensible" (casi todos lo son) sino:

> Ocultar lo que sirve para **hacerse pasar por vos**; dejar lo que sirve para **verificar que sos
> vos**.

Ese equilibrio importa: si se tapa todo, la copia no sirve para el trámite, se la rechazan, y la
persona termina mandando el documento entero sin proteger.

## Decisión 7. Cero red, y que el navegador lo imponga

- Ningún recurso externo: tipografías, íconos y estilos del mismo origen.
- Ninguna analítica, ninguna cookie, ningún CDN.
- `default-src 'self'`: ningún dominio externo puede recibir nada por ninguna vía, porque el
  navegador no permite contactarlo ni siquiera para cargar una imagen.
- CSP con `connect-src 'none'`: el navegador **bloquea** `fetch`, `XMLHttpRequest`, `sendBeacon`,
  WebSocket y EventSource. Aunque alguien inyectara código, no podría abrir una conexión de salida.
**Qué no cubre la CSP, dicho con precisión.** Una petición GET al *propio* origen, por ejemplo una
imagen cuya URL llevara datos, no está bloqueada: `img-src` necesita `'self'` para el ícono del
sitio. Ese canal solo alcanza al servidor que ya entrega el código, así que no agrega un riesgo
que no existiera. Una navegación de nivel superior hacia otro dominio tampoco la bloquea la CSP,
pero es visible: la página se iría. La garantía sin letra chica sigue siendo la prueba de
desconexión.

- El `sw.js` queda exento, porque necesita `connect-src 'self'` para cachear y sostener el modo
  offline.

## Decisión 8. Sin estado persistido, sin telemetría, sin "recordar"

Ningún dato del documento sobrevive a la sesión: sin borradores, sin historial de edición entre
visitas, sin miniaturas. Al cerrar la pestaña no queda rastro de la imagen. Los `ObjectURL` se
revocan y los canvas se vacían al reiniciar el flujo.

**Las dos únicas cosas que se guardan, ambas declaradas:**

1. El **caché del service worker**, que contiene únicamente el código de la aplicación, nunca
   imágenes del usuario, y existe para que la herramienta funcione sin conexión.
2. La **preferencia de tema**: una clave `copia-segura:theme` en `localStorage` con el valor
   `light` o `dark`. Se escribe solo si el usuario toca el selector; si nunca lo toca, no se guarda nada
   y el sitio sigue la preferencia del sistema.

La promesa se enuncia con ese nivel de precisión a propósito. Un "sin `localStorage`" a secas sería
más contundente, pero también falso, y una promesa de privacidad que el código contradice es peor
que no tener la función. Decir "hay exactamente una clave, contiene una de dos palabras, se puede
comprobar en el navegador" es además una señal de confianza más fuerte que una promesa absoluta.

---

## Estructura

```
copiasegura/
├── index.html            # la herramienta
├── como-funciona.html    # documentación técnica y demostración ejecutable
├── verificacion.html     # guía para comprobar que nada se sube
├── terminos.html         # términos de uso
├── css/
│   ├── base.css          # variables de tema, tipografía y layout común
│   ├── styles.css        # interfaz de la herramienta
│   └── document.css      # páginas de lectura larga
├── js/
│   ├── theme.js          # modo claro y oscuro (única clave en localStorage)
│   ├── templates.js      # tipos de documento y guía de qué tapar (datos)
│   ├── geometry.js       # enderezado por cuatro esquinas (homografía)
│   ├── editor.js         # canvas maestro, vista escalada, coordenadas
│   ├── redact.js         # relleno sólido y ruido criptográfico; deshacer
│   ├── watermark.js      # patrón en mosaico + código de copia
│   ├── export.js         # re-encode desde canvas, sin metadatos
│   ├── main.js           # orquestación y máquina de estados
│   ├── navigation.js     # índice y progreso en las páginas de lectura
│   └── demos.js          # demostración del ataque sobre texto pixelado
├── docs/
│   ├── ARQUITECTURA.md
│   ├── OFUSCACION.md     # modelo de amenazas del ocultamiento
│   ├── DOCUMENTOS.md     # qué contiene el DNI y qué conviene tapar
│   └── VERIFICACION.md
├── assets/icono.svg
├── sw.js
└── manifest.json
```

## Flujo del usuario

```
1. Cargar      → arrastrar/elegir archivo · el EXIF no sobrevive acá (re-render por canvas)
2. Documento   → elegir tipo (DNI AR frente/dorso · genérico) · enderezado y recorte
3. Proteger    → guía de qué tapar · el usuario marca las zonas · relleno destructivo
4. Marcar      → destinatario, propósito y fecha → patrón en mosaico + código de copia
5. Descargar   → PNG re-renderizado, nombre genérico, sin metadatos
```

## Compatibilidad objetivo

Cualquier navegador moderno: Chrome/Edge, Firefox y Safari recientes. Sin polyfills.
`crypto.getRandomValues` y `crypto.subtle` requieren contexto seguro (HTTPS, `localhost` o
`file://`), que es donde esta app corre siempre. Diseño mobile-first: la mayoría de la gente le saca
la foto al DNI con el celular y lo edita ahí mismo.
