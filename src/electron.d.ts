export {};

declare global {
  interface DbConfig {
    server: string;
    port: string;
    database: string;
    user: string;
    password?: string;
    encrypt: boolean;
    trustServerCertificate: boolean;
  }

  interface QueryParam {
    name: string;
    value: any;
    type?: string; // mssql type name e.g. 'VarChar', 'Int', 'Decimal', etc.
  }

  interface ElectronAPI {
    invoke(channel: 'win-minimize'): Promise<void>;
    invoke(channel: 'win-maximize'): Promise<void>;
    invoke(channel: 'win-close'): Promise<void>;
    invoke(channel: 'db-check-config'): Promise<boolean>;
    invoke(
      channel: 'db-get-connection-info'
    ): Promise<{ success: boolean; config?: DbConfig; error?: string }>;
    invoke(
      channel: 'db-save-config',
      config: DbConfig
    ): Promise<{ success: boolean; error?: string }>;
    invoke(
      channel: 'db-test-connection',
      config: DbConfig
    ): Promise<{ success: boolean; latency?: number; strength?: string; isInitialized?: boolean; error?: string }>;
    invoke(
      channel: 'db-initialize'
    ): Promise<{ success: boolean; error?: string }>;
    invoke(
      channel: 'auth-login',
      credentials: { username: string; password?: string }
    ): Promise<{ success: boolean; user?: { id: number; username: string; role: string }; error?: string }>;
    invoke(
      channel: 'db-bulk-import-students',
      data: { 
        studentsList: Array<{ student_id: string; full_name: string; dob: string; grade_class: string; guardian_phone: string }>;
        deactivateLeavers: boolean;
        creatorId: number;
      }
    ): Promise<{ success: boolean; added?: number; updated?: number; deactivated?: number; error?: string }>;
    invoke(
      channel: 'db-query',
      data: { query: string; params?: QueryParam[] }
    ): Promise<{ success: boolean; recordset?: any[]; rowsAffected?: number[]; error?: string }>;
    invoke(
      channel: 'print-receipt',
      htmlContent: string,
      options?: { pageSize?: string; landscape?: boolean }
    ): Promise<{ success: boolean; error?: string }>;
    invoke(
      channel: 'lic-get-machine-id'
    ): Promise<{ success: boolean; machineId?: string; error?: string }>;
    invoke(
      channel: 'lic-check-active'
    ): Promise<{ active: boolean; info?: { expiryDate: string; licenseKey: string }; error?: string }>;
    invoke(
      channel: 'lic-activate',
      data: { licenseKey: string; expiryDate: string; signature: string }
    ): Promise<{ success: boolean; error?: string }>;
    invoke(
      channel: 'lic-activate-online',
      data: { licenseKey: string }
    ): Promise<{ success: boolean; expiryDate?: string; error?: string }>;
    invoke(
      channel: 'upd-check'
    ): Promise<{ success: boolean; updateInfo?: any; error?: string }>;
    invoke(
      channel: 'upd-download'
    ): Promise<{ success: boolean; error?: string }>;
    invoke(
      channel: 'upd-install'
    ): Promise<{ success: boolean; error?: string }>;
    on(channel: string, func: (...args: any[]) => void): () => void;
  }

  interface Window {
    electronAPI: ElectronAPI;
  }
}
