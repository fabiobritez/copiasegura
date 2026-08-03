# Modelo de amenazas de la ofuscación

Este documento justifica cada elección técnica del proceso de ocultamiento. La pregunta que responde
no es "¿se ve tapado?" sino **"¿puede alguien, con las técnicas conocidas hoy, recuperar lo que se
tapó?"**, y también: *¿qué información se escapa por caminos que no son los píxeles?*

**Adversario asumido:** quien recibe la imagen final o la encuentra filtrada. Tiene la imagen
completa a resolución original, tiempo ilimitado, herramientas públicas de reconstrucción y
conocimiento del formato del documento (sabe qué tipografía usa un DNI, qué dígitos puede tener un
número de trámite). No tiene acceso al dispositivo del usuario.

---

## 1. Las técnicas y por qué unas sí y otras no

### Desenfoque (blur): no forma parte del código

El desenfoque es una convolución: cada píxel de salida es un promedio ponderado de sus vecinos. Eso
significa que **la información no se destruye, se redistribuye**. Ataques conocidos:

- **Deconvolución**: si se estima el kernel, y los kernels típicos son pocos y conocidos, el proceso
  se invierte total o parcialmente. Cuanto más suave el desenfoque, más trivial.
- **Ataque de diccionario**: para texto con alfabeto chico, como un número de trámite de 11
  dígitos, el atacante renderiza candidatos con la tipografía del documento, les aplica el mismo
  desenfoque y compara contra la zona ofuscada. No necesita invertir nada: solo confirmar cuál
  candidato coincide. Es la técnica que desanonimizó fotos "protegidas" en casos reales.

### Pixelado (mosaico): no forma parte del código

Cada bloque del mosaico es el **promedio real de los píxeles que tapa**: retiene información del
contenido. Herramientas públicas (Depix y sus sucesores) reconstruyen texto pixelado combinando el
ataque de diccionario con los promedios por bloque. Con la tipografía conocida de un documento de
identidad, es un escenario favorable para el atacante.

> Antecedente ilustrativo: en 2007 Interpol identificó a un prófugo revirtiendo el efecto "swirl"
> con el que distorsionaba su cara, porque la distorsión reordenaba píxeles sin destruirlos. Toda
> técnica que *transforma* en lugar de *reemplazar* es una promesa de reversibilidad futura.

### Relleno sólido: la opción por defecto

La zona se sobreescribe con un color constante. La información mutua entre la salida y el contenido
tapado es **cero**: no hay nada que invertir, no hay nada que comparar. Es la única familia de
técnicas categóricamente segura, y por eso es la opción por defecto.

### Relleno con ruido criptográfico: alternativa equivalente

La zona se sobreescribe con ruido de `crypto.getRandomValues()`. Es igual de seguro que el relleno
sólido **bajo una condición estricta**: el ruido debe ser independiente del contenido. Un "ruido"
derivado de los píxeles originales (perturbarlos, mezclarlos, reordenarlos) sería una fuga con
apariencia de seguridad.

## 2. La regla de oro (verificable en el código)

> **Ninguna función de ocultamiento lee los píxeles que va a tapar.**
> El valor de cada píxel de salida dentro de una zona tapada es independiente del valor original
> de todos los píxeles de esa zona.

Esto se audita leyendo `redact.js`: si una función de ocultamiento llama a `getImageData` sobre su
propia zona objetivo, es un bug de seguridad reportable. El único uso legítimo de `getImageData` al
ocultar es el snapshot para "deshacer", que vive en memoria (ver el punto 5 de la sección 3).

## 3. Fugas laterales: el checklist de `export.js`

Los píxeles son la mitad del problema. Los casos reales de ocultamiento fallido casi siempre caen acá:

1. **EXIF y thumbnail embebido.** El JPEG de una cámara lleva geolocalización, fecha, modelo y una
   miniatura incrustada de la imagen. Las ediciones ingenuas redactan la imagen grande y dejan la
   miniatura intacta. *Cierre:* el export re-renderiza desde el canvas; ningún byte del archivo
   original se copia.
2. **Datos residuales (aCropalypse, 2023).** Pixel Markup y Snipping Tool recortaban imágenes
   sobreescribiendo el archivo original y dejando los bytes sobrantes al final, con lo que el
   contenido "eliminado" seguía en el archivo. *Cierre:* el archivo exportado se genera de cero con
   `canvas.toBlob()`; no existe archivo previo del que arrastrar bytes.
3. **Nombre de archivo.** `IMG_20260802_consultorio_dr_lopez.jpg` es un dato personal. *Cierre:*
   nombre fijo `copia-segura_AAAA-MM-DD.png`, sin rastro del original.
4. **Tapar sobre la vista previa y exportar el original.** El bug clásico: tapar sobre la preview de
   800 px y exportar el bitmap de 4000 px intacto. *Cierre:* todas las operaciones se aplican al
   canvas maestro a resolución nativa; la vista es un espejo de solo lectura (Decisión 3 de la
   arquitectura).
5. **Historial de deshacer persistido.** Un snapshot en `localStorage` o IndexedDB es una copia sin
   tapar en disco. *Cierre:* deshacer vive solo en memoria y muere con la sesión.
6. **Recompresión posterior.** Guardar como JPEG después de tapar no debilita nada: la
   destrucción ocurrió antes del encode. Se ofrece PNG por defecto solo por fidelidad.

## 3 bis. La fuga que anula todo lo demás: el código de barras

**Tapar un dato impreso y dejar visible el código de barras del documento no protege nada.**

El PDF417 del DNI argentino contiene **nueve campos** en texto plano, separados por `@`, y el
primero es el número de trámite:

```
1. Número de trámite    4. Sexo        7. Fecha de nacimiento
2. Apellidos            5. N° de DNI   8. Fecha de emisión
3. Nombres              6. Ejemplar    9. Dígitos del CUIL
```

Cualquiera escanea ese código con un celular y obtiene todo eso, sin importar cuántos rectángulos
negros haya sobre el frente. Lo mismo vale para la MRZ, que por diseño es una transcripción legible
por máquina de los datos del documento, y para el código QR de la serie 2023 en adelante.

Consecuencia para el producto: **el objetivo número uno del ocultamiento es el código, no el texto
impreso.** El número de trámite impreso es secundario, porque su contenido ya viaja dentro del
código. Por eso la guía de la interfaz marca el código y la MRZ como *imprescindibles* y los lista
primero (ver [DOCUMENTOS.md](DOCUMENTOS.md)).

## 4. La firma de rastreo (marca de agua y código de copia)

Objetivo: si la copia aparece donde no debía, **identificar a qué destinatario se le entregó**.

- **Patrón visible en mosaico diagonal** con destinatario, propósito y fecha, cubriendo todo el
  documento y en particular las zonas de valor (fotografía, campos, MRZ). Quien quiera removerlo
  tiene que degradar lo que hace útil al documento.
- **Código de copia:** `SHA-256(destinatario | propósito | fecha)` truncado a 10 caracteres hex,
  calculado localmente con SubtleCrypto e impreso dentro del patrón. Aunque quien filtre la imagen
  recorte el texto legible, el código repetido identifica la copia: el usuario recalcula los
  códigos de las copias que emitió y encuentra la coincidencia. No requiere guardar nada, porque el
  código es reproducible desde los datos que el usuario ya conoce.

### Qué protege la marca, y qué no

Conviene separar dos funciones que suelen confundirse. **La marca de agua no protege los datos: eso
lo hace el ocultamiento.** Lo que la marca aporta es disuasión y atribución, es decir, saber a quién se
le entregó la copia que apareció donde no debía.

Esa distinción importa porque la marca sí es atacable, mientras que el relleno destructivo no lo es.
Un dato tapado con relleno sólido no se recupera; una marca de agua, con suficiente esfuerzo, se
puede remover.

### Por qué no se usa esteganografía

La alternativa habitual es ocultar el identificador en los bits menos significativos de la imagen,
de modo que no se vea. **La investigación desaconseja ese camino.** Zhao et al. (NeurIPS 2024)
demostraron, con pruebas formales y evaluación sobre cuatro esquemas distintos, que las marcas
invisibles a nivel de píxel son removibles mediante un ataque de regeneración: se le agrega ruido a
la imagen para destruir la marca y después se la reconstruye con un modelo generativo. Los autores
concluyen que la investigación debería abandonar las marcas invisibles en favor de marcas que
preserven la semántica de la imagen.

A eso se suma lo obvio: una marca LSB tampoco sobrevive a una recompresión de mensajería ni a una
captura de pantalla. Prometer un rastreo invisible sería vender una seguridad que no existe.

### Qué tan removible es la marca visible

Existe un campo de investigación dedicado a removerlas. Los resultados publicados permiten ubicar el
riesgo con precisión en lugar de especular.

Leng et al. (AAAI 2025) evaluaron marcas de **gran área**, que es la categoría de la que se usa acá,
y reportan que los modelos existentes "todavía tienen dificultades" con ellas. Sobre su conjunto de
prueba, el mejor método alcanza PSNR 26,8 y SSIM 0,92. Para dimensionarlo: una reconstrucción
prácticamente indistinguible del original estaría por encima de 40 dB de PSNR, así que a 27 dB
quedan diferencias perceptibles.

Un dato más útil todavía: el inpainting genérico, del tipo que usan las herramientas de consumo para
"borrar objetos", rinde mucho peor en esta tarea. LaMa obtiene PSNR 17,97 y SSIM 0,68 en el mismo
conjunto. Remover esta marca no es cuestión de apretar un botón en una app: requiere un modelo
especializado.

**Qué hace que esta marca esté en la categoría difícil:**

- Cubre el documento entero en mosaico, no es un logo en una esquina que se resuelve recortando.
- Se superpone deliberadamente a las zonas de alto detalle (fotografía, campos de texto, MRZ), así
  que removerla obliga a reconstruir contenido cuyo valor depende de ser exacto.
- El código de copia se repite muchas veces: hay que eliminar todas las instancias, no una.
- Sobre un documento, los artefactos del inpainting son visibles para quien lo verifica, y una
  imagen retocada pierde valor frente a un destinatario que exige ver la marca.

**Y el límite, dicho sin adornos:** difícil no es imposible. Alguien con un modelo especializado y
motivación suficiente puede remover buena parte de la marca. La función de atribución se debilita
frente a ese adversario. Lo que no se debilita es el ocultamiento, que es donde vive la protección
real.

## 5. Fuera del alcance

Para honestidad del modelo, la herramienta no protege contra:

- el destinatario legítimo que usa mal los datos que sí necesitaba ver;
- un dispositivo comprometido (malware, extensión maliciosa) en el momento de la edición;
- una foto del documento sacada *antes* de pasar por la herramienta;
- reidentificación por los datos que el usuario decidió dejar visibles.

Cada una de estas cosas está fuera del control de cualquier software de edición local, y decirlo
explícitamente es parte de no vender más seguridad de la que existe.
