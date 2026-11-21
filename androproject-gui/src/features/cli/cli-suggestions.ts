// ============================================================================
// ARCHIVO: cli-suggestions.ts
// QUÉ HACE: Genera sugerencias y opciones de respuesta interactivas basadas
//           en la consulta del usuario y el contenido de la respuesta recibida.
// CÓMO FUNCIONA: Analiza palabras clave e intención (saludos, diagnósticos,
//           batería, memoria, apps, comandos) y retorna botones de acción rápida.
// POR QUÉ: Elimina respuestas estáticas/robóticas permitiendo continuar la
//           interacción fluida con un solo clic (< 200 líneas).
// ============================================================================

export function generateContextSuggestions(query: string, response: string): string[] {
  const q = query.toLowerCase();
  const r = response.toLowerCase();

  // 1. Saludos o aperturas conversacionales
  if (q.includes('hola') || q.includes('buenas') || q.includes('hello') || q.length < 6) {
    return [
      '¿Cuál es el estado del dispositivo conectado?',
      'Diagnosticar batería y temperatura',
      'Ver aplicaciones instaladas recientemente',
      'Comprobar consumo de memoria RAM',
    ];
  }

  // 2. Batería y consumo de energía
  if (q.includes('batería') || q.includes('battery') || r.includes('battery')) {
    return [
      'dumpsys battery',
      '¿Qué procesos consumen más batería en segundo plano?',
      'Recomendar configuración para ahorrar batería',
    ];
  }

  // 3. Memoria, RAM y rendimiento
  if (q.includes('memoria') || q.includes('ram') || q.includes('meminfo') || r.includes('memtotal')) {
    return [
      'cat /proc/meminfo',
      'top -m 5 -s cpu',
      '¿Cómo liberar memoria RAM de forma segura sin matar servicios clave?',
    ];
  }

  // 4. Aplicaciones y paquetes
  if (q.includes('app') || q.includes('paquete') || q.includes('package') || r.includes('package:')) {
    return [
      'pm list packages -3',
      'pm list packages -d',
      '¿Qué aplicaciones de usuario están consumiendo almacenamiento?',
    ];
  }

  // 5. Diagnóstico general o párrafos largos
  if (q.length > 50 || r.length > 200) {
    return [
      'Explicar los puntos clave en 3 viñetas concisas',
      '¿Cuáles son los comandos ADB exactos para aplicar esto?',
      '¿Existe algún riesgo para el sistema operativo o datos del usuario?',
    ];
  }

  // Fallback conversacional universal
  return [
    '¿Qué pasos debo seguir a continuación?',
    'Generar comando ADB recomendado para este caso',
    'Analizar posibles cuellos de botella en este componente',
  ];
}
