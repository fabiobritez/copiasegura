/*
 * Copia Segura
 * Copyright (C) 2026 Fabio Britez
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/*
 * templates.js - Document types and guidance on what to cover.
 *
 * The criterion is not "which data is sensitive" (nearly all of it is) but
 * which data lets someone impersonate you (hide) versus which the recipient
 * needs to verify it is you (keep). Over-redacting gets the copy rejected, and
 * then people end up sending the whole document unprotected.
 *
 * In Argentina the critical case is the "número de trámite" combined with the
 * DNI number: the key ANSES, AFIP, Mi Argentina, banks and phone carriers use
 * to validate identity online. It travels in plain text inside the PDF417/QR
 * code, so covering the printed number without covering the code is useless.
 *
 * Guidance is text, not coordinates: at least seven series of the Argentine DNI
 * circulate with different layouts, and an automatic proposal that fails is
 * worse than none, because a rushed user confirms it without looking.
 */

const TEMPLATES = [
  {
    id: 'dni-ar',
    name: 'DNI argentino',
    description: 'Cualquier versión de la tarjeta, frente o dorso.',
    key:
      'El código de barras o QR. Contiene tu número de trámite, apellido, nombres, ' +
      'número de DNI y fecha de nacimiento en texto plano: se leen con un celular.',
    hide: [
      {
        title: 'Código de barras PDF417 o código QR',
        detail:
          'Lo más importante de todo. Cualquiera lo escanea y obtiene tu número de trámite, apellido, nombres, sexo, número de DNI, ejemplar, fecha de nacimiento y dígitos del CUIL.',
        critical: true,
      },
      {
        title: 'Número de trámite',
        detail:
          'Junto con tu número de DNI es la llave para validar identidad en ANSES, AFIP, Mi Argentina, bancos y telefónicas. Es el dato más usado para abrir cuentas a nombre de otro.',
        critical: true,
      },
      {
        title: 'Las líneas con «<<<<<» del dorso',
        detail:
          'Es la zona de lectura mecánica: una transcripción de tus datos legible por máquina.',
        critical: true,
      },
      {
        title: 'Firma',
        detail: 'Se usa para falsificar autorizaciones y contratos.',
      },
      {
        title: 'Huella dactilar',
        detail: 'Es un dato biométrico irrevocable: si se filtra, no se puede cambiar.',
      },
      {
        title: 'Domicilio',
        detail: 'Salvo que el trámite sea justamente acreditar dónde vivís.',
      },
    ],
    keep: [
      {
        title: 'Foto, apellido y nombres',
        detail: 'Es lo que permite verificar que el documento es tuyo.',
      },
      {
        title: 'Número de DNI',
        detail:
          'Casi siempre es el dato que el trámite necesita. Por sí solo no alcanza para validar identidad: el riesgo aparece al combinarlo con el número de trámite.',
      },
      {
        title: 'Fecha de nacimiento y de vencimiento',
        detail: 'Se usan para confirmar mayoría de edad y que el documento esté vigente.',
      },
    ],
  },
  {
    id: 'generico',
    name: 'Otro documento',
    description: 'Pasaporte, licencia de conducir, factura de servicios, recibo de sueldo.',
    key:
      'Cualquier código de barras o QR, y los números de serie o trámite. ' +
      'Los códigos casi siempre repiten en texto plano lo que está impreso, y a veces más.',
    hide: [
      {
        title: 'Cualquier código de barras o QR',
        detail:
          'Casi siempre repiten en texto plano los datos impresos, y a veces agregan otros que no están a la vista.',
        critical: true,
      },
      {
        title: 'Números de serie, trámite o expediente',
        detail: 'Identifican al ejemplar y suelen usarse para validaciones en línea.',
        critical: true,
      },
      {
        title: 'Datos bancarios y de cuenta',
        detail: 'CBU, número de tarjeta, número de cuenta: nunca hacen falta para identificarte.',
        critical: true,
      },
      {
        title: 'Firma, huella y domicilio',
        detail: 'Salvo que el trámite los requiera explícitamente.',
      },
    ],
    keep: [
      {
        title: 'Lo que el destinatario pidió',
        detail:
          'Preguntale qué necesita ver antes de tapar. Una copia sobre-ofuscada suele ser rechazada, y ahí la gente termina mandando el documento entero sin proteger.',
      },
    ],
  },
];

function templateById(id) {
  return TEMPLATES.find((t) => t.id === id) || null;
}
