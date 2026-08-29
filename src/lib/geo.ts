/**
 * Geographic and Media utilities for GPS validation and Selfie compression.
 */

// Helper to obtain the official Bolivia date string (YYYY-MM-DD) for America/La_Paz
export function getBoliviaTodayDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

/**
 * Formatea una fecha académica (YYYY-MM-DD) al formato oficial boliviano (DD/MM/YYYY)
 * sin riesgo de desplazamiento por zona horaria UTC.
 */
export function formatAcademicDate(fecha: string | null | undefined): string {
  if (!fecha) return '';
  const trimmed = fecha.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-');
    return `${day}/${month}/${year}`;
  }
  // Si contiene hora o timestamp, convertir respetando estrictamente America/La_Paz
  try {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('es-BO', {
        timeZone: 'America/La_Paz',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(d);
    }
  } catch {
    // fallback
  }
  return trimmed;
}

/**
 * Formatea una fecha académica (YYYY-MM-DD) con el día de la semana en español para Bolivia
 * Ej: "Viernes, 28/08/2026"
 */
export function formatAcademicDateWithDay(fecha: string | null | undefined): string {
  if (!fecha) return '';
  const trimmed = fecha.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-');
    const d = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0);
    const dayName = new Intl.DateTimeFormat('es-BO', {
      timeZone: 'America/La_Paz',
      weekday: 'long'
    }).format(d);
    const capitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    return `${capitalized}, ${day}/${month}/${year}`;
  }
  return formatAcademicDate(fecha);
}

// Haversine formula to compute distance in meters between two lat/lon coordinates
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export interface LocationResult {
  latitud: number;
  longitud: number;
  precision: number; // in meters
  error?: string;
}

export function getCurrentGPSPosition(): Promise<LocationResult> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({
        latitud: 0,
        longitud: 0,
        precision: 9999,
        error: 'El navegador o dispositivo no soporta geolocalización GPS.'
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitud: pos.coords.latitude,
          longitud: pos.coords.longitude,
          precision: Math.round(pos.coords.accuracy || 10)
        });
      },
      (err) => {
        let msg = 'No se pudo obtener la ubicación GPS.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Permiso de ubicación denegado por el usuario o navegador.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Información de ubicación no disponible en el dispositivo.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Tiempo de espera agotado al consultar el sensor GPS.';
        }
        resolve({
          latitud: 0,
          longitud: 0,
          precision: 9999,
          error: msg
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    );
  });
}

/**
 * Compress canvas/image to maximum 720px dimensions and ~100-150KB JPEG blob
 */
export function compressCanvasToBlob(
  sourceCanvas: HTMLCanvasElement,
  maxDimension = 720,
  quality = 0.75
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    let width = sourceCanvas.width;
    let height = sourceCanvas.height;

    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    const destCanvas = document.createElement('canvas');
    destCanvas.width = width;
    destCanvas.height = height;

    const ctx = destCanvas.getContext('2d');
    if (!ctx) {
      reject(new Error('No se pudo inicializar el contexto 2D para compresión'));
      return;
    }

    ctx.drawImage(sourceCanvas, 0, 0, width, height);

    destCanvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Error al generar blob comprimido de la selfie'));
        }
      },
      'image/jpeg',
      quality
    );
  });
}
