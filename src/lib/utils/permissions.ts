// src/lib/utils/permissions.ts
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export enum Role {
  ADMIN = 'admin',
  SAISIE = 'saisie',
  CONSULTATION = 'consultation'
}

export interface TokenWithRole {
  sub?: string;
  role?: string;
  nom?: string;
  id?: string;
}

export interface UserPermissions {
  isAdmin?: boolean;
  canViewClients?: boolean;
  canEditClients?: boolean;
  canViewProducts?: boolean;
  canEditProducts?: boolean;
  canViewInvoices?: boolean;
  canEditInvoices?: boolean;
  canViewQuotes?: boolean;
  canEditQuotes?: boolean;
}

export const DEFAULT_PERMISSIONS: UserPermissions = {
  isAdmin: false,
  canViewClients: true,
  canEditClients: false,
  canViewProducts: true,
  canEditProducts: false,
  canViewInvoices: true,
  canEditInvoices: false,
  canViewQuotes: true,
  canEditQuotes: false,
};

export const ADMIN_PERMISSIONS: UserPermissions = {
  isAdmin: true,
  canViewClients: true,
  canEditClients: true,
  canViewProducts: true,
  canEditProducts: true,
  canViewInvoices: true,
  canEditInvoices: true,
  canViewQuotes: true,
  canEditQuotes: true,
};

/**
 * Vérifie si l'utilisateur a le rôle requis
 */
export async function checkPermission(
  request: NextRequest,
  requiredRole: Role | Role[],
  userId?: string
): Promise<{ authorized: boolean; token?: TokenWithRole }> {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  }) as TokenWithRole | null;

  if (!token || !token.role) {
    return { authorized: false };
  }

  // Vérification spécifique pour les opérations liées à un utilisateur spécifique
  if (userId && token.sub !== userId) {
    if (token.role !== Role.ADMIN) {
      return { authorized: false };
    }
  }

  // Si aucun rôle particulier n'est requis, on vérifie juste l'authentification
  if (!requiredRole) {
    return { authorized: true, token };
  }

  // Convertir en tableau pour uniformiser le traitement
  const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

  // Vérifier si le rôle de l'utilisateur correspond à l'un des rôles requis
  const hasRequiredPermission = requiredRoles.some(role => token.role === role);

  // Les administrateurs ont tous les droits
  if (token.role === Role.ADMIN) {
    return { authorized: true, token };
  }

  // Pour les rôles de consultation, aucune action d'écriture n'est autorisée
  if (token.role === Role.CONSULTATION) {
    return { authorized: false, token };
  }

  // Pour le rôle de saisie, seules certaines actions sont autorisées
  if (token.role === Role.SAISIE && hasRequiredPermission) {
    return { authorized: true, token };
  }

  // Par défaut, refuser l'accès
  return { authorized: false, token };
}

/**
 * Vérifie si l'utilisateur peut effectuer une action de lecture
 */
export async function canRead(request: NextRequest): Promise<boolean> {
  const { authorized } = await checkPermission(request, [Role.ADMIN, Role.SAISIE, Role.CONSULTATION]);
  return authorized;
}

/**
 * Vérifie si l'utilisateur peut effectuer une action d'écriture (création, modification, suppression)
 */
export async function canWrite(request: NextRequest): Promise<boolean> {
  const { authorized } = await checkPermission(request, [Role.ADMIN, Role.SAISIE]);
  return authorized;
}

/**
 * Vérifie si l'utilisateur est administrateur
 */
export async function isAdmin(request: NextRequest): Promise<boolean> {
  const { authorized } = await checkPermission(request, Role.ADMIN);
  return authorized;
}

/**
 * Vérifier si l'utilisateur dispose des autorisations requises
 */
export function hasPermission(userPermissions: UserPermissions, requiredPermission: keyof UserPermissions): boolean {
  return !!userPermissions[requiredPermission];
}

/**
 * Vérifier si l'utilisateur dispose des privilèges administrateur
 */
export function isAdminPermission(userPermissions: UserPermissions): boolean {
  return !!userPermissions.isAdmin;
}

/**
 * Combiner les autorisations utilisateur avec les autorisations par défaut
 */
export function mergePermissions(userPermissions: Partial<UserPermissions>): UserPermissions {
  return {
    ...DEFAULT_PERMISSIONS,
    ...userPermissions,
  };
}

/**
 * Extraire les informations d'autorisation d'une requête Next
 */
export function getUserPermissionsFromRequest(request: NextRequest): UserPermissions | null {
  // Vous pouvez extraire les données d'autorisation du header, session ou autre
  const userRole = request.headers.get('x-user-role');
  
  if (userRole === 'admin') {
    return ADMIN_PERMISSIONS;
  }
  
  return DEFAULT_PERMISSIONS;
}