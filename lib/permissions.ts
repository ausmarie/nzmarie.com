/**
 * Permissions and Role Management
 * 
 * Handles user role checking and data filtering based on permissions.
 */

export enum UserRole {
  SUPER_ADMIN = 'super_admin',  // Louis - Full access including financials
  ADMIN = 'admin',               // Marie - Business data only
}

export const USER_ACCOUNTS = {
  LOUIS: 'nzlouis.com@gmail.com',
  MARIE: 'nzmarie.com@gmail.com',
} as const;

/**
 * Get user role from email
 */
export function getUserRole(email: string): UserRole | null {
  if (email === USER_ACCOUNTS.LOUIS || email === USER_ACCOUNTS.MARIE) {
    return UserRole.SUPER_ADMIN;
  }
  return null;
}

/**
 * Check if user is super admin (Louis or Marie)
 */
export function isSuperAdmin(email: string): boolean {
  return email === USER_ACCOUNTS.LOUIS || email === USER_ACCOUNTS.MARIE;
}

/**
 * Check if user is admin (Marie or Louis)
 */
export function isAdmin(email: string): boolean {
  return email === USER_ACCOUNTS.MARIE || email === USER_ACCOUNTS.LOUIS;
}

/**
 * Financial and sensitive fields that only Louis can see
 */
const FINANCIAL_FIELDS = [
  'actual_cost',
  'printing_cost',
  'postage_cost',
  'total_cost',
  'conversion_value',
  'commission_amount',
  'total_revenue',
  'roi_percentage',
  'listing_price',
  'estimated_value',
] as const;

/**
 * Filter data based on user role
 * 
 * Removes financial fields if user is not super admin
 */
export function filterByRole<T extends Record<string, unknown>>(
  data: T[],
  userEmail: string,
  additionalHiddenFields: string[] = []
): T[] {
  // Louis sees everything
  if (isSuperAdmin(userEmail)) {
    return data;
  }

  // Marie cannot see financial data
  const hideFields = [...FINANCIAL_FIELDS, ...additionalHiddenFields];

  return data.map(item => {
    const filtered = { ...item };
    hideFields.forEach(field => {
      delete filtered[field];
    });
    return filtered as T;
  });
}

/**
 * Filter single object based on role
 */
export function filterObjectByRole<T extends Record<string, unknown>>(
  data: T,
  userEmail: string,
  additionalHiddenFields: string[] = []
): T {
  return filterByRole([data], userEmail, additionalHiddenFields)[0];
}

/**
 * Permissions map for specific features
 */
export const PERMISSIONS: Record<string, UserRole[]> = {
  // Basic access
  'bookings:read': [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  'bookings:update': [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  
  'properties:read': [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  'properties:select': [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  
  'outreach:read': [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  'outreach:create': [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  'outreach:mark_sent': [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  
  // Louis only
  'analytics:view': [UserRole.SUPER_ADMIN],
  'downloads:view': [UserRole.SUPER_ADMIN],
  'suburb_pdf:manage': [UserRole.SUPER_ADMIN],
  'campaigns:create': [UserRole.SUPER_ADMIN],
  'finance:view': [UserRole.SUPER_ADMIN],
  'system:manage': [UserRole.SUPER_ADMIN],
  'data:export_all': [UserRole.SUPER_ADMIN],
  
  // Marie can do
  'clients:manage': [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  'followup:schedule': [UserRole.SUPER_ADMIN, UserRole.ADMIN],
};

/**
 * Check if user has specific permission
 */
export function hasPermission(
  userEmail: string,
  permission: keyof typeof PERMISSIONS
): boolean {
  const role = getUserRole(userEmail);
  if (!role) return false;
  
  const allowedRoles = PERMISSIONS[permission];
  return allowedRoles ? allowedRoles.includes(role) : false;
}

/**
 * Throw error if user doesn't have permission
 */
export function requirePermission(
  userEmail: string,
  permission: keyof typeof PERMISSIONS
): void {
  if (!hasPermission(userEmail, permission)) {
    throw new Error(`Permission denied: ${permission}`);
  }
}

/**
 * Get user display info
 */
export function getUserInfo(email: string): {
  name: string;
  role: UserRole | null;
  roleName: string;
} {
  const role = getUserRole(email);
  
  return {
    name: email === USER_ACCOUNTS.LOUIS ? 'Louis' : email === USER_ACCOUNTS.MARIE ? 'Marie' : 'Unknown',
    role,
    roleName: role === UserRole.SUPER_ADMIN ? 'Super Admin' : role === UserRole.ADMIN ? 'Admin' : 'Unknown',
  };
}
