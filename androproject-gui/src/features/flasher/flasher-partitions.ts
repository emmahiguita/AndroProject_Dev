// ============================================================================
// ARCHIVO: flasher-partitions.ts
// QUÉ HACE: Catálogo estructurado de particiones Android (Estándar, Slots A/B
//           y Particiones Críticas de Radio/Bootloader) para Fastboot.
// CÓMO FUNCIONA: Define identificador técnico, etiqueta legible, descripción
//           de propósito y bandera `critical` para exigir doble confirmación.
// POR QUÉ: Separar datos estáticos de dominio de la vista `FlasherView` (< 200L).
// ============================================================================

export interface FlashPartitionSpec {
  id: string;
  label: string;
  desc: string;
  critical: boolean;
  group: 'standard' | 'ab' | 'critical';
}

export const PARTITIONS: FlashPartitionSpec[] = [
  { id: 'boot',        label: 'boot',        desc: 'Kernel y ramdisk de arranque principal', critical: false, group: 'standard' },
  { id: 'init_boot',   label: 'init_boot',   desc: 'Ramdisk genérico de inicio (Android 13+)', critical: false, group: 'standard' },
  { id: 'vendor_boot', label: 'vendor_boot', desc: 'Módulos kernel del fabricante (Android 12+)', critical: false, group: 'standard' },
  { id: 'recovery',    label: 'recovery',    desc: 'Entorno de recuperación (TWRP / AOSP)', critical: false, group: 'standard' },
  { id: 'dtbo',        label: 'dtbo',        desc: 'Device Tree Blob Overlay de hardware', critical: false, group: 'standard' },
  { id: 'vbmeta',      label: 'vbmeta',      desc: 'Hash de verificación Android Verified Boot (AVB)', critical: false, group: 'standard' },
  { id: 'super',       label: 'super',       desc: 'Contenedor de particiones dinámicas (system/vendor/product)', critical: false, group: 'standard' },
  { id: 'system',      label: 'system',      desc: 'Imagen del sistema operativo Android', critical: false, group: 'standard' },
  { id: 'vendor',      label: 'vendor',      desc: 'Binarios HAL y drivers propietarios', critical: false, group: 'standard' },
  { id: 'product',     label: 'product',     desc: 'Aplicaciones y recursos del producto', critical: false, group: 'standard' },
  { id: 'userdata',    label: 'userdata',    desc: 'Datos del usuario (formatea almacenamiento interno)', critical: true, group: 'standard' },
  { id: 'boot_a',      label: 'boot_a',      desc: 'Slot A — Kernel de arranque', critical: false, group: 'ab' },
  { id: 'boot_b',      label: 'boot_b',      desc: 'Slot B — Kernel de arranque', critical: false, group: 'ab' },
  { id: 'recovery_a',  label: 'recovery_a',  desc: 'Slot A — Recuperación', critical: false, group: 'ab' },
  { id: 'recovery_b',  label: 'recovery_b',  desc: 'Slot B — Recuperación', critical: false, group: 'ab' },
  { id: 'bootloader',  label: 'bootloader',  desc: 'CRÍTICO: Gestor de arranque primario (riesgo de hard-brick)', critical: true, group: 'critical' },
  { id: 'radio',       label: 'radio',       desc: 'CRÍTICO: Firmware de banda base celular', critical: true, group: 'critical' },
  { id: 'modem',       label: 'modem',       desc: 'CRÍTICO: Módem DSP / RF del SoC', critical: true, group: 'critical' },
  { id: 'persist',     label: 'persist',     desc: 'CRÍTICO: Calibración de fábrica (sensores, Wi-Fi, DRM)', critical: true, group: 'critical' },
];
