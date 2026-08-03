# Cómo contribuir

Gracias por el interés en el proyecto. Antes de escribir código conviene leer
[docs/ARQUITECTURA.md](docs/ARQUITECTURA.md): casi todas las restricciones que siguen se explican
ahí, y varias parecen arbitrarias hasta que se entiende el motivo.

## Preparar el entorno

No hay entorno que preparar. No hay build, ni dependencias, ni `node_modules`, ni gestores de
paquetes.

1. Clonar el repositorio.
2. Abrir los archivos con cualquier editor de texto.
3. Probar los cambios abriendo `index.html` con doble clic.

Para probar el service worker y el modo PWA hace falta servir el sitio por HTTP, porque los
navegadores no registran service workers sobre `file://`. Cualquier servidor estático sirve, por
ejemplo `python3 -m http.server` desde la raíz del repositorio.

Conviene probar los cambios además con el navegador desconectado de internet: si algo deja de
funcionar sin conexión, es una regresión.

## Reglas que no se negocian

Son las que sostienen la propuesta del proyecto. Un pull request que las incumpla no se puede
integrar aunque el código esté bien escrito.

**Sin dependencias en el núcleo y sin recursos de terceros.** Ninguna librería, ningún CDN, ninguna
tipografía remota, ninguna analítica, ninguna fuente de íconos externa. Todo lo que la página carga
viene del mismo origen. La CSP con `connect-src 'none'` no se relaja.

**Sin build step.** El código que se sirve tiene que ser el mismo que se lee en el repositorio. Sin
bundler, sin minificación, sin transpilación.

**Scripts clásicos, no módulos ES.** Los módulos rompen el uso desde `file://`, que es la modalidad
de máxima confianza y la que el proyecto recomienda para uso recurrente. Los scripts nuevos se
declaran en el HTML, en orden de dependencias.

**Nada del documento se persiste.** Ni imágenes, ni borradores, ni historial de deshacer, ni
miniaturas en `localStorage`, IndexedDB, el caché del service worker o cualquier otro
almacenamiento. La única clave permitida en `localStorage` es `copia-segura:theme`, con el valor
`light` o `dark`.

**Toda técnica de ofuscación nueva debe cumplir la regla de oro:** el valor de cada píxel de salida
dentro de una zona tapada tiene que ser independiente del contenido tapado. Una función de
ocultamiento no lee los píxeles que va a tapar. Eso excluye desenfoque, pixelado, mosaico, remolinos y
cualquier transformación del contenido original, por más agresiva que se vea. El análisis está en
[docs/OFUSCACION.md](docs/OFUSCACION.md).

**Las operaciones destructivas van sobre el canvas maestro a resolución nativa**, nunca sobre la
vista previa ni como elemento superpuesto.

## Estilo

**El código va en inglés**: nombres de variables, funciones, clases CSS y estructuras. **La
documentación y el texto visible en la interfaz van en español rioplatense.** Los comentarios del
código están en español y explican por qué, no qué.

Otras pautas:

- HTML semántico y accesible. La herramienta tiene que poder usarse con teclado y con lector de
  pantalla.
- CSS sin framework, con las propiedades personalizadas ya definidas en `css/base.css`. Los estilos
  tienen que funcionar en modo claro y en modo oscuro.
- Diseño mobile-first: la mayoría de la gente edita la foto del documento en el celular.
- Sin emojis en el código ni en la documentación.

## Documentar el porqué

Cuando un cambio afecta una garantía de seguridad o de privacidad, el pull request tiene que
actualizar la documentación correspondiente en el mismo commit. Una promesa que el código
contradice es peor que no tener la función.

## Pull requests

- Un cambio por pull request, con un título que describa el efecto.
- Explicar qué problema resuelve y, si toca el proceso de ocultamiento o el export, cómo se probó.
- Indicar en qué navegadores se probó.
- Para cambios grandes conviene abrir antes un issue y discutir el enfoque, así nadie escribe código
  que después no se puede integrar.

## Reportar problemas

Los errores y las propuestas van a los issues del repositorio. Las vulnerabilidades tienen su
propio canal: ver [SECURITY.md](SECURITY.md).

Al reportar un problema con una imagen, no adjuntar documentos reales. Una captura con datos
ficticios alcanza.

## Licencia y marca

Las contribuciones se publican bajo la [AGPL-3.0](LICENSE), igual que el resto del proyecto. El
nombre "Copia Segura" tiene una política separada en [TRADEMARK.md](TRADEMARK.md), que conviene
leer antes de publicar un fork.
