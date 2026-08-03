# El DNI argentino: qué contiene y qué conviene tapar

Investigación sobre el formato del DNI que fundamenta las recomendaciones de la herramienta.
Fecha: agosto de 2026.

---

## 1. El hallazgo más importante: el código de barras contiene todo

El código PDF417 del DNI argentino guarda **nueve campos en texto plano**, separados por `@`, y el
primero es el número de trámite:

```
1. Número de trámite    4. Sexo         7. Fecha de nacimiento
2. Apellidos            5. N° de DNI    8. Fecha de emisión
3. Nombres              6. Ejemplar     9. Dígitos del CUIL
```

> **Tapar el número de trámite impreso y dejar el código visible no protege nada.** Cualquiera lo
> escanea con un celular y obtiene todo eso en texto plano.

Lo mismo vale para la zona de lectura mecánica (las líneas con `<<<<<`), que por diseño es una
transcripción legible por máquina de los datos del documento, y para el código QR de los DNI
emitidos desde 2023.

**Por eso la herramienta marca el código y la MRZ como lo primero a tapar**, por encima del número
impreso: el número impreso es secundario porque su contenido ya viaja dentro del código.

## 2. Por qué el número de trámite es el dato crítico

El número de trámite **combinado con el número de DNI** es la llave que usan ANSES, AFIP, Mi
Argentina, bancos y telefónicas para validar identidad en línea. Es el par de datos con el que se
abren cuentas a nombre de otra persona.

El número de DNI por sí solo es mucho menos peligroso, y suele ser justamente lo que el trámite
necesita ver. El riesgo aparece al combinarlo con el número de trámite.

## 3. No existe un DNI único: hay al menos siete series en circulación

Según Regula Forensics, proveedor comercial de software de reconocimiento documental, circulan **en
simultáneo** las series **2009, 2012, 2014, 2019, 2020, 2023 y 2024**. Ninguna se invalidó: RENAPER
confirmó que "los documentos ya emitidos no deberán reemplazarse en forma obligatoria y mantendrán
su vigencia hasta su vencimiento".

| Serie | Particularidad |
|---|---|
| 2009 a 2012 | MRZ **no estándar**, desalineada respecto de las dimensiones del documento |
| 2012 a 2020 | Diseño consolidado, PDF417, huella del pulgar |
| 2023 en adelante (DNIe) | Policarbonato con chip; **código QR en lugar de PDF417**; MRZ conforme OACI 9303 |

El DNIe 2023 se define en la [Disposición 1255/2023](https://www.argentina.gob.ar/normativa/nacional/disposici%C3%B3n-1255-2023-394189/actualizacion),
cuyo Anexo I ubica en el reverso: domicilio, lugar de nacimiento, número de CUIL, número de
trámite, código QR, imagen fantasma y zona de lectura mecánica.
 
## Fuentes

- [Disposición 1255/2023, RENAPER, características del DNI electrónico](https://www.argentina.gob.ar/normativa/nacional/disposici%C3%B3n-1255-2023-394189/actualizacion)
- [RENAPER, lanzamiento del nuevo DNI electrónico con chip](https://www.argentina.gob.ar/noticias/el-renaper-lanza-el-nuevo-dni-electronico-con-chip-que-se-adapta-los-mas-altos-estandares)
- [Regula Forensics, Challenges of Argentine ID card processing](https://regulaforensics.com/blog/argentine-id-card-processing/)
- [Estándares para Dummies, parseo del código PDF417 del DNI argentino](https://estandaresparadummies.blogspot.com/2020/12/parseo-del-codigo-pdf417-del-dni.html)
- [Wikipedia, Documento nacional de identidad (Argentina)](https://es.wikipedia.org/wiki/Documento_nacional_de_identidad_(Argentina))
- [Argentina.gob.ar, características y medidas de seguridad del DNI](https://www.argentina.gob.ar/interior/dni/caracteristicas-y-medidas-de-seguridad-de-tu-dni)
