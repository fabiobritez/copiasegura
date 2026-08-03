# Política de seguridad

Copia Segura es una herramienta de seguridad: un fallo en el código puede exponer datos de un
documento de identidad. Los reportes son bienvenidos.

## Qué se considera una vulnerabilidad

Interesa especialmente todo lo que rompa alguna de las garantías que el proyecto afirma cumplir:

- Que un dato tapado pueda recuperarse desde el archivo exportado, sea por los píxeles o por
  metadatos, bytes residuales o miniaturas embebidas.
- Que alguna función de ocultamiento derive el resultado del contenido que tapa, en contra de la regla
  de oro documentada en [docs/OFUSCACION.md](docs/OFUSCACION.md).
- Que una operación destructiva se aplique sobre la vista previa y no sobre el canvas maestro, de
  modo que el archivo exportado conserve el dato.
- Cualquier salida de datos por red, o cualquier forma de eludir la CSP con `connect-src 'none'`.
- Cualquier persistencia de la imagen o de datos del documento en `localStorage`, IndexedDB, el
  caché del service worker o cualquier otro almacenamiento.
- XSS u otra inyección de código en las páginas del proyecto.

Los errores de interfaz o de usabilidad que no exponen datos no son vulnerabilidades: para eso
corresponde abrir un issue normal.

## Cómo reportar

Si el reporte **no expone datos sensibles al publicarse**, abrir un issue en el repositorio es la
vía más rápida y deja el análisis a la vista de todos.

Si el reporte permite recuperar información de un documento real o describe un ataque práctico
todavía sin corregir, conviene el canal privado: usar el formulario de reporte privado de GitHub
(**Security** y luego **Report a vulnerability**) en el repositorio.

En cualquiera de los dos casos, ayuda incluir:

- Qué garantía se rompe y en qué archivo o función.
- Pasos concretos para reproducirlo, con el navegador y la versión usados.
- Si aplica, una imagen de prueba generada con datos ficticios. No hace falta enviar documentos
  reales, y es preferible que no se envíen.

## Qué esperar

El proyecto se mantiene sin financiamiento y en tiempo libre, así que no ofrece plazos de respuesta
ni recompensas económicas. Lo que sí se puede esperar:

- Que el reporte se lea y se responda cuando haya una respuesta útil que dar.
- Que la corrección, si corresponde, quede en el historial público de commits, con la explicación
  del problema.
- Crédito a quien reportó, salvo que prefiera lo contrario.

## Versiones cubiertas

Solo la última versión publicada en la rama principal. No hay ramas de mantenimiento ni versiones
anteriores con soporte.

Este proyecto no tiene control sobre instancias operadas por terceros ni sobre forks, aunque
deriven de este código. Los problemas de una instancia de terceros se reportan a quien la opera.
