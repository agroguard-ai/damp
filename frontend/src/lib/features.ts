/**
 * Funcionalidades que existen en el código pero están ocultas en la interfaz.
 * Para habilitar una, poner su flag en true.
 */
export const FEATURES = {
  /**
   * Pastoreo rotativo (CU012): pestaña en Cercos. El backend (módulo `rotations`,
   * /farms/:farmId/rotation) y los componentes (RotationView, RotationMap) siguen
   * implementados; solo se oculta en la UI hasta terminar de definirlo.
   */
  grazingRotation: false,
} as const;
