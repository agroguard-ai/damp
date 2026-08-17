export interface AlertSettings {
  farmId: string;
  feverThreshold: number;
  hypothermiaThreshold: number;
  inactivityMinutes: number;
  emailOnEscape: boolean;
  emailOnHealth: boolean;
}

export interface UpdateAlertSettingsPayload {
  feverThreshold?: number;
  hypothermiaThreshold?: number;
  inactivityMinutes?: number;
  emailOnEscape?: boolean;
  emailOnHealth?: boolean;
}
