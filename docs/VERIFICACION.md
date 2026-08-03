# Cómo verificar que nada se sube

La guía completa, con diagramas y los cuatro niveles de verificación, vive en el sitio:
**[verificacion.html](../verificacion.html)**. Se puede abrir desde el sitio publicado o
localmente, haciendo doble clic en el archivo.

Existe en una sola versión a propósito. El mismo texto en dos lugares termina separándose, y en un
proyecto cuyo valor es la exactitud de lo que afirma, una guía desactualizada es peor que no
tenerla.

## Resumen de los cuatro niveles

1. **La prueba de la desconexión** (2 minutos): cortar internet y usar la herramienta igual. Si
   funciona sin conexión, no pudo subir nada.
2. **Mirar el tráfico** (10 minutos): con las herramientas de desarrollo del navegador, filtrar por
   `method:POST`. No debería aparecer ninguno.
3. **Leer el código** (30 minutos): no hay empaquetador ni minificación, así que lo que se sirve es
   lo que está publicado. Buscar las primitivas que permitirían transmitir datos.
4. **Capturar la red desde afuera** (máximo rigor): con mitmproxy o Wireshark, donde la página no
   tiene injerencia.

Y la recomendación que hace innecesario confiar en cualquier promesa: descargar el repositorio y
usar la herramienta localmente, sin conexión.
